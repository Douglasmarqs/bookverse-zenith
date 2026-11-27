/**
 * Parses a `.epub` file (a zip archive) entirely in the browser into the
 * same `Book` shape the reader already knows how to display — so a
 * user-uploaded EPUB reads with the exact same UI as a Gutenberg title.
 *
 * EPUB structure in a nutshell:
 *   META-INF/container.xml  → points at the "OPF" package file
 *   <opf file>.opf          → <metadata> (title/author), <manifest> (every
 *                              file in the book + its id), <spine> (reading
 *                              order, referencing manifest ids)
 *   each spine item          → an XHTML file with the actual chapter content
 */
import JSZip from "jszip";
import type { Book, Chapter, ChapterBlock } from "./sample-book";
import { newEpubId } from "./epub-store";
import { languageOfBook } from "./book-language";

const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB — generous for a text-only book

export class EpubParseError extends Error {}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    // Some EPUB content files are technically-invalid XHTML — retry as HTML,
    // which the browser's parser is far more forgiving about.
    return new DOMParser().parseFromString(text, "text/html");
  }
  return doc;
}

function joinPath(dir: string, relative: string): string {
  if (relative.startsWith("/")) return relative.slice(1);
  const baseParts = dir === "" ? [] : dir.replace(/\/+$/, "").split("/");
  const relParts = relative.split("/");
  for (const part of relParts) {
    if (part === "." || part === "") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }
  return baseParts.join("/");
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path) ?? zip.file(decodeURIComponent(path));
  if (!file) throw new EpubParseError(`Arquivo "${path}" não encontrado dentro do EPUB.`);
  return file.async("string");
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").trim();
}

/**
 * Merges consecutive paragraph fragments that don't end in sentence-ending
 * punctuation — protects against source HTML that hard-wraps text without
 * proper `<p>` boundaries (see the matching fix in public-domain.ts for the
 * same issue in plain-text Gutenberg files).
 */
function reflowParagraphs(paragraphs: string[]): string[] {
  const merged: string[] = [];
  let buffer = "";
  for (const p of paragraphs) {
    buffer = buffer ? `${buffer} ${p}` : p;
    const endsSentence = /[.!?][”"')\]]?$/.test(buffer) || buffer.length > 500;
    if (endsSentence) {
      merged.push(buffer);
      buffer = "";
    }
  }
  if (buffer) merged.push(buffer);
  return merged;
}

/** Resolves an `<img src>` / `<image xlink:href>` value against the
 * chapter file's own folder (not the OPF's — a chapter nested in a
 * subfolder references images relative to itself), reads it from the zip,
 * and returns a downscaled JPEG data URL. Results are cached per book so
 * an illustration reused across chapters (a decorative divider, etc.) is
 * only decoded/resized once. */
async function resolveImageSrc(
  zip: JSZip,
  chapterDir: string,
  rawSrc: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  const clean = rawSrc.split("#")[0]?.trim();
  if (!clean || clean.startsWith("data:") || /^https?:\/\//i.test(clean)) return clean || null;

  const path = joinPath(chapterDir, decodeURIComponent(clean));
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  try {
    const file = zip.file(path) ?? zip.file(clean);
    if (!file) {
      cache.set(path, null);
      return null;
    }
    // 900px on the long side is plenty for how wide the reader column
    // gets, and keeps an illustrated book's total IndexedDB footprint
    // reasonable even with dozens of images.
    const resized = await downscaleZipImage(file, path, 900, 0.78);
    cache.set(path, resized);
    return resized;
  } catch {
    cache.set(path, null);
    return null;
  }
}

/** Hard ceiling on inline images extracted per book — a pathological case
 * (a technical manual with thousands of tiny diagrams) shouldn't make
 * import hang or bloat storage unreasonably. Comfortably above what any
 * normal illustrated novel/children's book/manga volume needs. */
const MAX_IMAGES_PER_BOOK = 300;

/** Extracts readable paragraphs *and* inline images from one chapter's
 * (X)HTML content, preserving the order they appear in — this is what
 * lets illustrations show up inline the way they do in a Kindle book,
 * instead of only the cover surviving import. */
async function extractChapter(
  html: string,
  index: number,
  zip: JSZip,
  chapterDir: string,
  imageCache: Map<string, string | null>,
  imageBudget: { remaining: number },
  splits: { frag: string; title: string }[] = [],
): Promise<(Chapter & { continues: boolean })[]> {
  const doc = parseXml(html);
  const body = doc.body ?? doc.documentElement;

  const heading = body?.querySelector("h1, h2, h3");
  const title = textOf(heading) || textOf(doc.querySelector("title")) || `Capítulo ${index + 1}`;

  // Several chapters packed in one file (common in Project Gutenberg
  // EPUBs: a third of a novel per file) are split where the book's own
  // table of contents points, so each one is a real, light chapter.
  const anchors = splits
    .map((s) => ({
      el: (doc.getElementById(s.frag) ??
        doc.querySelector(`[id="${s.frag.replace(/"/g, '\\"')}"]`) ??
        doc.querySelector(`[name="${s.frag.replace(/"/g, '\\"')}"]`)) as Element | null,
      title: s.title,
    }))
    .filter((a): a is { el: Element; title: string } => !!a.el && isHeadingAnchor(a.el))
    // An illustration or empty marker just before the heading: the
    // heading's own text names the chapter better than the TOC caption.
    .map((a) => {
      if (/^h[1-6]$/i.test(a.el.tagName) || a.el.closest(HEADINGS)) return a;
      const h = /^h[1-6]$/i.test(a.el.firstElementChild?.tagName ?? "")
        ? a.el.firstElementChild
        : nextHeading(a.el);
      const text = chapterName(h?.textContent ?? "");
      return text ? { ...a, title: text } : a;
    })
    .sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  const splitting = anchors.length >= 2;

  const segments: { title: string; paragraphs: string[]; blocks: ChapterBlock[] }[] = [
    { title, paragraphs: [], blocks: [] },
  ];
  let paragraphs = segments[0]!.paragraphs;
  let blocks = segments[0]!.blocks;
  let nextAnchor = 0;
  const enterSegmentsBefore = (el: Element) => {
    if (!splitting) return;
    while (nextAnchor < anchors.length) {
      const a = anchors[nextAnchor]!.el;
      const reached =
        a === el ||
        a.contains(el) ||
        !!(a.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!reached) break;
      const seg = {
        title: anchors[nextAnchor]!.title,
        paragraphs: [] as string[],
        blocks: [] as ChapterBlock[],
      };
      segments.push(seg);
      paragraphs = seg.paragraphs;
      blocks = seg.blocks;
      nextAnchor += 1;
    }
  };

  async function pushImage(rawSrc: string | null, alt: string | null) {
    if (!rawSrc || imageBudget.remaining <= 0) return;
    const src = await resolveImageSrc(zip, chapterDir, rawSrc, imageCache);
    if (!src) return;
    imageBudget.remaining -= 1;
    blocks.push({ type: "image", src, alt: alt || undefined });
  }

  // querySelectorAll('p, img, image') returns every matching element in
  // document order regardless of nesting, so this naturally interleaves
  // text and pictures the way they actually appear in the chapter — a
  // <p> that wraps only an <img> contributes no (empty) text block, and
  // the <img> itself is still picked up in its right position.
  const inlineEls = Array.from(body?.querySelectorAll("p, img, image") ?? []);

  if (inlineEls.some((el) => el.tagName.toLowerCase() === "p")) {
    for (const el of inlineEls) {
      enterSegmentsBefore(el);
      const tag = el.tagName.toLowerCase();
      if (tag === "img" || tag === "image") {
        const rawSrc =
          el.getAttribute("src") ??
          el.getAttribute("xlink:href") ??
          el.getAttributeNS?.("http://www.w3.org/1999/xlink", "href") ??
          el.getAttribute("href");
        await pushImage(rawSrc, el.getAttribute("alt"));
        continue;
      }
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      paragraphs.push(text);
      blocks.push({ type: "text", paragraphIndex: paragraphs.length - 1 });
    }
  } else {
    // No <p> tags (some EPUBs use <div>s per paragraph, or plain text) —
    // fall back to the raw text content split on blank lines, then reflow
    // in case the source hard-wraps at every line instead of per-paragraph.
    // With chapter anchors, each chapter's text is the stretch between its
    // heading and the next one.
    const toParagraphs = (raw: string) =>
      reflowParagraphs(
        raw
          .trim()
          .split(/\n\s*\n/)
          .map((p) => p.replace(/\s+/g, " ").trim())
          .filter((p) => p.length > 0),
      );
    const headingEnd = (el: Element): Element => {
      if (/^h[1-6]$/i.test(el.tagName)) return el;
      const inner = el.closest(HEADINGS);
      if (inner) return inner;
      let next = el.nextElementSibling;
      for (let i = 0; next && i < 3; i++, next = next.nextElementSibling)
        if (/^h[1-6]$/i.test(next.tagName)) return next;
      return el;
    };
    const texts: string[] = [];
    if (splitting && body) {
      const between = (after: Element | null, before: Element | null) => {
        const r = doc.createRange();
        if (after) r.setStartAfter(after);
        else r.setStart(body, 0);
        if (before) r.setEndBefore(before);
        else r.setEnd(body, body.childNodes.length);
        return r.toString();
      };
      texts.push(between(null, anchors[0]!.el));
      anchors.forEach((a, i) => {
        texts.push(between(headingEnd(a.el), anchors[i + 1]?.el ?? null));
        segments.push({ title: a.title, paragraphs: [], blocks: [] });
      });
    } else texts.push(body?.textContent ?? "");
    texts.forEach((raw, i) => {
      const seg = segments[i]!;
      for (const p of toParagraphs(raw)) {
        seg.paragraphs.push(p);
        seg.blocks.push({ type: "text", paragraphIndex: seg.paragraphs.length - 1 });
      }
    });
    // No positional fidelity available in this fallback path — any
    // pictures still get imported, appended to the chapter they sit in.
    const imgEls = Array.from(body?.querySelectorAll("img, image") ?? []);
    for (const el of imgEls) {
      const rawSrc =
        el.getAttribute("src") ??
        el.getAttribute("xlink:href") ??
        el.getAttributeNS?.("http://www.w3.org/1999/xlink", "href") ??
        el.getAttribute("href");
      const at = splitting
        ? anchors.filter(
            (a) => !!(a.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
          ).length
        : 0;
      blocks = segments[at]!.blocks;
      await pushImage(rawSrc, el.getAttribute("alt"));
    }
  }

  return segments
    .filter((g) => g.paragraphs.length > 0 || g.blocks.some((b) => b.type === "image"))
    .map((g, i) => ({
      id: `cap-${index + i}`,
      title: g.title || title,
      paragraphs: g.paragraphs,
      blocks: g.blocks,
      // Text before this file's first chapter heading continues the
      // chapter that began in the previous file.
      continues: splitting && g === segments[0],
    }));
}

function guessMimeType(href: string): string {
  const ext = href.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/**
 * Downscales a cover image to a small JPEG data URL. EPUB covers are
 * embedded directly (there's no image-hosting server involved), and this
 * same string gets copied into the Firestore library entry so "Minha
 * biblioteca" can show it without touching IndexedDB — Firestore caps
 * documents at 1MB, so an unresized cover (some are multiple MB) would
 * silently fail to save. 480px on the long side at JPEG quality 0.82 keeps
 * every cover comfortably under ~60KB, plenty sharp for how covers are
 * actually displayed in the app.
 */
/**
 * Downscales an image data URL to a JPEG within the given bounds. Used for
 * both the cover (small, square-ish) and in-chapter illustrations (larger,
 * can be tall/wide) — EPUB source images are sometimes several MB, and
 * without this a heavily-illustrated book could bloat IndexedDB storage
 * and make the reader noticeably slower to scroll.
 */
async function downscaleImage(dataUrl: string, maxDim: number, quality: number): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = dataUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // If anything about decoding/resizing fails, fall back to the
    // original — better a possibly-large image than none at all, and
    // IndexedDB (unlike Firestore) has no strict per-document size cap.
    return dataUrl;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Decodes and shrinks an image from the zip without freezing the screen:
 * createImageBitmap decodes off the main thread and canvas.toBlob encodes
 * asynchronously (toDataURL does both synchronously — a big illustration
 * could stall the page for a quarter of a second on a phone). Falls back
 * to the classic path for formats the fast one can't handle (SVG…). */
async function downscaleZipImage(
  file: JSZip.JSZipObject,
  path: string,
  maxDim: number,
  quality: number,
): Promise<string> {
  const mime = guessMimeType(path);
  if (mime !== "image/svg+xml" && typeof createImageBitmap === "function") {
    try {
      const blob = new Blob([await file.async("arraybuffer")], { type: mime });
      const bmp = await createImageBitmap(blob);
      const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        const out = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, "image/jpeg", quality),
        );
        if (out) return await blobToDataUrl(out);
      } else bmp.close();
    } catch {
      // fall through to the classic path
    }
  }
  const base64 = await file.async("base64");
  return downscaleImage(`data:${mime};base64,${base64}`, maxDim, quality);
}

const HEADINGS = "h1, h2, h3, h4, h5, h6";
/** "He rode a black horse. CHAPTER III." → "CHAPTER III." — illustrated
 * editions put the picture's caption inside the chapter heading. */
function chapterName(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  const m = /\b(chapter|cap[ií]tulo|capitulo|chapitre|kapitel)\s*([ivxlcdm]+|\d+)\b/i.exec(t);
  if (!m || m.index === 0) return t;
  return `${m[1]} ${t.slice(m.index + m[1]!.length).trim()}`;
}

function nextHeading(el: Element): Element | null {
  let next = el.nextElementSibling;
  for (let i = 0; next && i < 3; i++, next = next.nextElementSibling)
    if (/^h[1-6]$/i.test(next.tagName)) return next;
  return null;
}

/** A table-of-contents target that starts a chapter: a heading, inside a
 * heading, or an empty anchor right before one. (Gutenberg TOCs also list
 * illustrations and page numbers, which must not split a chapter.) */
function isHeadingAnchor(el: Element): boolean {
  if (/^h[1-6]$/i.test(el.tagName) || el.closest(HEADINGS)) return true;
  const firstChild = el.firstElementChild;
  if (firstChild && /^h[1-6]$/i.test(firstChild.tagName)) return true;
  let next = el.nextElementSibling;
  // Skip empty markers (another anchor, a page number span) before the heading.
  for (let i = 0; next && i < 3; i++, next = next.nextElementSibling) {
    if (/^h[1-6]$/i.test(next.tagName)) return true;
    if ((next.textContent ?? "").trim().length > 0) return false;
  }
  return false;
}

interface TocTarget {
  path: string;
  frag: string | null;
  title: string;
}

/** The book's own table of contents (EPUB 3 nav, else EPUB 2 NCX), as
 * file + anchor targets — used to split files that pack many chapters. */
async function readToc(
  zip: JSZip,
  opfDoc: Document,
  manifest: Map<string, { href: string; mediaType: string; properties: string }>,
): Promise<TocTarget[]> {
  const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
  const target = (dir: string, href: string, title: string): TocTarget => {
    const [file = "", frag] = href.split("#");
    return {
      path: joinPath(dir, decodeURIComponent(file)),
      frag: frag ? decodeURIComponent(frag) : null,
      title: chapterName(title),
    };
  };
  const nav = [...manifest.values()].find((m) => m.properties.split(/\s+/).includes("nav"));
  if (nav) {
    try {
      const doc = parseXml(await readText(zip, nav.href));
      const navs = Array.from(doc.getElementsByTagName("nav"));
      const tocNav =
        navs.find((n) =>
          /\btoc\b/.test(
            n.getAttribute("epub:type") ??
              n.getAttributeNS?.("http://www.idpf.org/2007/ops", "type") ??
              "",
          ),
        ) ?? navs[0];
      const links = tocNav ? Array.from(tocNav.getElementsByTagName("a")) : [];
      const out = links
        .filter((a) => a.getAttribute("href"))
        .map((a) => target(dirOf(nav.href), a.getAttribute("href")!, a.textContent ?? ""));
      if (out.length) return out;
    } catch {
      // fall back to the NCX
    }
  }
  const ncxId = opfDoc.querySelector("spine")?.getAttribute("toc");
  const ncx =
    (ncxId ? manifest.get(ncxId) : undefined) ??
    [...manifest.values()].find((m) => m.mediaType === "application/x-dtbncx+xml");
  if (!ncx || !/ncx/i.test(ncx.mediaType + ncx.href)) return [];
  const doc = parseXml(await readText(zip, ncx.href));
  return Array.from(doc.getElementsByTagName("navPoint"))
    .map((np) => {
      const src = np.getElementsByTagName("content")[0]?.getAttribute("src");
      const label = np.getElementsByTagName("text")[0]?.textContent ?? "";
      return src ? target(dirOf(ncx.href), src, label) : null;
    })
    .filter((t): t is TocTarget => !!t);
}

export async function parseEpubFile(file: File): Promise<Book> {
  if (file.size > MAX_FILE_SIZE) {
    throw new EpubParseError("Este arquivo é muito grande (limite de 60MB).");
  }
  if (!file.name.toLowerCase().endsWith(".epub")) {
    throw new EpubParseError("Envie um arquivo .epub válido.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new EpubParseError("Não foi possível abrir este arquivo — ele parece estar corrompido.");
  }

  // 1. Find the OPF package file via META-INF/container.xml
  const containerXml = await readText(zip, "META-INF/container.xml").catch(() => null);
  let opfPath: string | null = null;
  if (containerXml) {
    const containerDoc = parseXml(containerXml);
    opfPath = containerDoc.querySelector("rootfile")?.getAttribute("full-path") ?? null;
  }
  if (!opfPath) {
    // Fallback: scan for any .opf file in the archive.
    opfPath = Object.keys(zip.files).find((p) => p.toLowerCase().endsWith(".opf")) ?? null;
  }
  if (!opfPath) {
    throw new EpubParseError(
      "Não foi possível localizar o conteúdo do EPUB (arquivo .opf ausente).",
    );
  }

  const opfXml = await readText(zip, opfPath);
  const opfDoc = parseXml(opfXml);
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  // 2. Metadata
  const title =
    textOf(opfDoc.querySelector("metadata > title, metadata > dc\\:title")) ||
    file.name.replace(/\.epub$/i, "");
  const author =
    textOf(opfDoc.querySelector("metadata > creator, metadata > dc\\:creator")) ||
    "Autor desconhecido";
  const declaredLanguage =
    textOf(opfDoc.querySelector("metadata > language, metadata > dc\\:language")) || null;

  // 3. Manifest: id -> { href, mediaType }
  const manifestItems = Array.from(opfDoc.querySelectorAll("manifest > item"));
  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  for (const item of manifestItems) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (!id || !href) continue;
    manifest.set(id, {
      href: joinPath(opfDir, href),
      mediaType: item.getAttribute("media-type") ?? "",
      properties: item.getAttribute("properties") ?? "",
    });
  }

  // 4. Cover image (EPUB3 `properties="cover-image"`, else EPUB2 `<meta name="cover">`)
  let cover: string | null = null;
  const epub3Cover = manifestItems.find((i) =>
    (i.getAttribute("properties") ?? "").includes("cover-image"),
  );
  const coverMetaId = opfDoc
    .querySelector('metadata > meta[name="cover"]')
    ?.getAttribute("content");
  const coverEntry = epub3Cover
    ? manifest.get(epub3Cover.getAttribute("id") ?? "")
    : coverMetaId
      ? manifest.get(coverMetaId)
      : undefined;
  if (coverEntry) {
    try {
      const coverFile = zip.file(coverEntry.href);
      if (coverFile) cover = await downscaleZipImage(coverFile, coverEntry.href, 480, 0.82);
    } catch {
      cover = null; // cover is a nice-to-have, never block the import over it
    }
  }

  // 5. Spine: reading order, each idref -> manifest item
  const spineRefs = Array.from(opfDoc.querySelectorAll("spine > itemref"))
    .map((el) => el.getAttribute("idref"))
    .filter((id): id is string => !!id);

  if (spineRefs.length === 0) {
    throw new EpubParseError("Este EPUB não tem uma ordem de leitura (spine) reconhecível.");
  }

  const toc = await readToc(zip, opfDoc, manifest).catch(() => [] as TocTarget[]);

  const chapters: Chapter[] = [];
  let index = 0;
  const imageCache = new Map<string, string | null>();
  const imageBudget = { remaining: MAX_IMAGES_PER_BOOK };
  for (const idref of spineRefs) {
    const item = manifest.get(idref);
    if (!item) continue;
    // Skip non-HTML spine entries (rare, but the spec technically allows it).
    if (item.mediaType && !/html|xml/.test(item.mediaType)) continue;
    try {
      const html = await readText(zip, item.href);
      const chapterDir = item.href.includes("/")
        ? item.href.slice(0, item.href.lastIndexOf("/") + 1)
        : "";
      const splits = toc
        .filter((t) => t.path === item.href && t.frag)
        .map((t) => ({ frag: t.frag!, title: t.title }));
      const parts = await extractChapter(
        html,
        index,
        zip,
        chapterDir,
        imageCache,
        imageBudget,
        splits,
      );
      // Give the screen a frame between chapters so big books never freeze it.
      await new Promise((r) => setTimeout(r, 0));
      for (const { continues, ...chapter } of parts) {
        const prev = chapters[chapters.length - 1];
        if (continues && prev) {
          // Append to the chapter it belongs to, re-numbering its paragraphs.
          const offset = prev.paragraphs.length;
          prev.paragraphs.push(...chapter.paragraphs);
          prev.blocks = [
            ...(prev.blocks ??
              prev.paragraphs
                .slice(0, offset)
                .map((_, i) => ({ type: "text" as const, paragraphIndex: i }))),
            ...(chapter.blocks ?? []).map((b) =>
              b.type === "text" ? { ...b, paragraphIndex: b.paragraphIndex + offset } : b,
            ),
          ];
          continue;
        }
        chapters.push({ ...chapter, id: `cap-${index}` });
        index += 1;
      }
    } catch (err) {
      console.warn(`[epub] skipping unreadable spine item ${item.href}`, err);
    }
  }

  if (chapters.length === 0) {
    throw new EpubParseError("Não encontramos texto legível dentro deste EPUB.");
  }

  const book = { id: newEpubId(), title, author, cover, chapters };
  return { ...book, language: languageOfBook({ language: declaredLanguage, chapters }) };
}
