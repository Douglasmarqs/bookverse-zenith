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
import type { Book, Chapter, ChapterBlock, BookNavigationEntry } from "./reading-book";
import { resolveEpubHref, resolveBookLocation } from "./epub-navigation";
import { newEpubId } from "./epub-store";
import { isEmbeddedRasterImageReference } from "./file-validation";

const MAX_FILE_SIZE = 60 * 1024 * 1024; // 60MB — generous for a text-only book
const MAX_ARCHIVE_ENTRIES = 5000;
const MAX_DECLARED_UNCOMPRESSED_BYTES = 160 * 1024 * 1024;
const MAX_TEXT_RESOURCE_CHARS = 4_000_000;
const MAX_TOTAL_CHAPTER_CHARS = 30_000_000;
const MAX_IMAGE_BASE64_CHARS = 12_000_000;
const MAX_NAVIGATION_ENTRIES = 3000;
type PendingLink = {
  chapterIndex: number;
  paragraphIndex: number;
  href: string;
  startOffset: number;
  endOffset: number;
};

export class EpubParseError extends Error {}
class EpubResourceLimitError extends EpubParseError {}

/** JSZip reads this from the ZIP directory, though its TypeScript interface
 * keeps `_data` private. Extraction limits below still apply if absent. */
function declaredSize(file: JSZip.JSZipObject): number | null {
  const size = (file as JSZip.JSZipObject & { _data?: { uncompressedSize?: unknown } })._data
    ?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) && size >= 0 ? size : null;
}

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
  if ((declaredSize(file) ?? 0) > MAX_TEXT_RESOURCE_CHARS * 4) {
    throw new EpubResourceLimitError("Um recurso de texto do EPUB excede o limite de importação.");
  }
  const text = await file.async("string");
  if (text.length > MAX_TEXT_RESOURCE_CHARS) {
    throw new EpubResourceLimitError("Um recurso de texto do EPUB excede o limite de importação.");
  }
  return text;
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
  if (!isEmbeddedRasterImageReference(rawSrc)) return null;
  const clean = rawSrc.split(/[?#]/, 1)[0]?.trim();
  if (!clean) return null;

  const path = joinPath(chapterDir, decodeURIComponent(clean));
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  try {
    const file = zip.file(path) ?? zip.file(clean);
    if (!file) {
      cache.set(path, null);
      return null;
    }
    if ((declaredSize(file) ?? 0) > MAX_IMAGE_BASE64_CHARS) {
      cache.set(path, null);
      return null;
    }
    const base64 = await file.async("base64");
    if (base64.length > MAX_IMAGE_BASE64_CHARS) {
      cache.set(path, null);
      return null;
    }
    const raw = `data:${guessMimeType(path)};base64,${base64}`;
    // 900px on the long side is plenty for how wide the reader column
    // gets, and keeps an illustrated book's total IndexedDB footprint
    // reasonable even with dozens of images.
    const resized = await downscaleImage(raw, 900, 0.78);
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
  sourcePath: string,
  pendingLinks: PendingLink[],
): Promise<Chapter> {
  const doc = parseXml(html);
  const body = doc.body ?? doc.documentElement;
  body?.querySelectorAll("script, style, iframe, object, embed, form").forEach((el) => el.remove());

  const heading = body?.querySelector("h1, h2, h3");
  const title = textOf(heading) || textOf(doc.querySelector("title")) || `Capítulo ${index + 1}`;

  const paragraphs: string[] = [];
  const blocks: ChapterBlock[] = [];
  const paragraphElements: Element[] = [];

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
      paragraphElements.push(el);
      for (const link of Array.from(el.querySelectorAll("a[href]")).slice(0, 100)) {
        const label = (link.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!label) continue;
        const range = doc.createRange();
        range.selectNodeContents(el);
        range.setEndBefore(link);
        const leading = (link.textContent ?? "").match(/^\s*/)?.[0] ?? "";
        const startOffset = (range.toString() + leading).replace(/\s+/g, " ").trimStart().length;
        if (text.slice(startOffset, startOffset + label.length) !== label) continue;
        pendingLinks.push({
          chapterIndex: index,
          paragraphIndex: paragraphs.length - 1,
          href: link.getAttribute("href")!,
          startOffset,
          endOffset: startOffset + label.length,
        });
      }
      blocks.push({ type: "text", paragraphIndex: paragraphs.length - 1 });
    }
  } else {
    // No <p> tags (some EPUBs use <div>s per paragraph, or plain text) —
    // fall back to the raw text content split on blank lines, then reflow
    // in case the source hard-wraps at every line instead of per-paragraph.
    const raw = (body?.textContent ?? "").trim();
    const reflowed = reflowParagraphs(
      raw
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 0),
    );
    for (const p of reflowed) {
      paragraphs.push(p);
      blocks.push({ type: "text", paragraphIndex: paragraphs.length - 1 });
    }
    // No positional fidelity available in this fallback path — any
    // pictures still get imported, just appended after the text rather
    // than interleaved at their exact original spot.
    const imgEls = Array.from(body?.querySelectorAll("img, image") ?? []);
    for (const el of imgEls) {
      const rawSrc =
        el.getAttribute("src") ??
        el.getAttribute("xlink:href") ??
        el.getAttributeNS?.("http://www.w3.org/1999/xlink", "href") ??
        el.getAttribute("href");
      await pushImage(rawSrc, el.getAttribute("alt"));
    }
  }

  const anchors: Record<string, number> = Object.create(null);
  let anchorParagraph = 0;
  for (const element of Array.from(body?.querySelectorAll("[id], a[name]") ?? []).slice(
    0,
    MAX_NAVIGATION_ENTRIES,
  )) {
    while (anchorParagraph < paragraphElements.length - 1) {
      const paragraph = paragraphElements[anchorParagraph];
      if (
        paragraph.contains(element) ||
        element.contains(paragraph) ||
        element.compareDocumentPosition(paragraph) & Node.DOCUMENT_POSITION_FOLLOWING
      )
        break;
      anchorParagraph++;
    }
    const id = element.getAttribute("id") ?? element.getAttribute("name");
    if (id && !Object.hasOwn(anchors, id)) anchors[id] = anchorParagraph;
  }
  const direction = body?.getAttribute("dir") ?? doc.documentElement.getAttribute("dir");
  return {
    id: `cap-${index}`,
    title,
    paragraphs,
    blocks,
    sourcePath,
    anchors,
    ...(direction === "rtl" || direction === "ltr" ? { direction } : {}),
  };
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
async function downscaleImage(
  dataUrl: string,
  maxDim: number,
  quality: number,
): Promise<string | null> {
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
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // Do not persist the original, potentially very large or malformed data.
    return null;
  }
}

async function downscaleCover(dataUrl: string): Promise<string | null> {
  return downscaleImage(dataUrl, 480, 0.82);
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
  if (Object.keys(zip.files).length > MAX_ARCHIVE_ENTRIES) {
    throw new EpubResourceLimitError(
      "Este EPUB contém arquivos demais para uma importação segura.",
    );
  }
  const declaredBytes = Object.values(zip.files).reduce(
    (total, entry) => total + (declaredSize(entry) ?? 0),
    0,
  );
  if (declaredBytes > MAX_DECLARED_UNCOMPRESSED_BYTES) {
    throw new EpubResourceLimitError(
      "O conteúdo expandido deste EPUB excede o limite de importação.",
    );
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

  // 2. Metadata
  const title =
    textOf(opfDoc.querySelector("metadata > title, metadata > dc\\:title")) ||
    file.name.replace(/\.epub$/i, "");
  const author =
    textOf(opfDoc.querySelector("metadata > creator, metadata > dc\\:creator")) ||
    "Autor desconhecido";

  // 3. Manifest: id -> { href, mediaType }
  const manifestItems = Array.from(opfDoc.querySelectorAll("manifest > item"));
  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  for (const item of manifestItems) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (!id || !href) continue;
    const resolved = resolveEpubHref(opfPath, href);
    if (!resolved) continue;
    manifest.set(id, {
      href: resolved.path,
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
  if (coverEntry && isEmbeddedRasterImageReference(coverEntry.href)) {
    try {
      const coverFile = zip.file(coverEntry.href);
      if (coverFile) {
        if ((declaredSize(coverFile) ?? 0) > MAX_IMAGE_BASE64_CHARS) {
          throw new EpubResourceLimitError("A capa deste EPUB é grande demais.");
        }
        const base64 = await coverFile.async("base64");
        if (base64.length > MAX_IMAGE_BASE64_CHARS) {
          throw new EpubResourceLimitError("A capa deste EPUB é grande demais.");
        }
        const raw = `data:${guessMimeType(coverEntry.href)};base64,${base64}`;
        cover = await downscaleCover(raw);
      }
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

  const chapters: Chapter[] = [];
  const pendingLinks: PendingLink[] = [];
  const importWarnings: string[] = [];
  let index = 0;
  const imageCache = new Map<string, string | null>();
  const imageBudget = { remaining: MAX_IMAGES_PER_BOOK };
  let totalChapterChars = 0;
  for (const idref of spineRefs) {
    const item = manifest.get(idref);
    if (!item) continue;
    // Skip non-HTML spine entries (rare, but the spec technically allows it).
    if (item.mediaType && !/html|xml/.test(item.mediaType)) continue;
    const pendingLinkCount = pendingLinks.length;
    try {
      const html = await readText(zip, item.href);
      totalChapterChars += html.length;
      if (totalChapterChars > MAX_TOTAL_CHAPTER_CHARS) {
        throw new EpubResourceLimitError("O texto deste EPUB excede o limite de importação.");
      }
      const chapterDir = item.href.includes("/")
        ? item.href.slice(0, item.href.lastIndexOf("/") + 1)
        : "";
      const chapter = await extractChapter(
        html,
        index,
        zip,
        chapterDir,
        imageCache,
        imageBudget,
        item.href,
        pendingLinks,
      );
      const hasImages = chapter.blocks?.some((b) => b.type === "image") ?? false;
      if (chapter.paragraphs.length > 0 || hasImages) {
        chapters.push(chapter);
        index += 1;
      }
    } catch (err) {
      pendingLinks.length = pendingLinkCount;
      if (err instanceof EpubResourceLimitError) throw err;
      importWarnings.push(
        "Um trecho do arquivo não pôde ser importado. Confira a integridade do EPUB original.",
      );
      console.warn(`[epub] skipping unreadable spine item ${item.href}`, err);
    }
  }

  if (chapters.length === 0) {
    throw new EpubParseError("Não encontramos texto legível dentro deste EPUB.");
  }

  for (const link of pendingLinks) {
    const chapter = chapters[link.chapterIndex];
    if (!chapter) continue;
    const location = resolveBookLocation(chapters, chapter.sourcePath!, link.href);
    if (!location) continue;
    chapter.links ??= {};
    (chapter.links[link.paragraphIndex] ??= []).push({
      ...location,
      startOffset: link.startOffset,
      endOffset: link.endOffset,
    });
  }

  const navigation: BookNavigationEntry[] = [];
  const navItem = Array.from(manifest.values()).find((item) =>
    item.properties.split(/\s+/).includes("nav"),
  );
  const ncxItem =
    manifest.get(opfDoc.querySelector("spine")?.getAttribute("toc") ?? "") ??
    Array.from(manifest.values()).find((item) => item.mediaType === "application/x-dtbncx+xml");
  for (const item of [navItem, ncxItem]) {
    if (!item || navigation.length) continue;
    try {
      const navDoc = parseXml(await readText(zip, item.href));
      const nav = Array.from(navDoc.querySelectorAll("nav")).find((el) =>
        (
          el.getAttributeNS("http://www.idpf.org/2007/ops", "type") ??
          el.getAttribute("epub:type") ??
          ""
        )
          .split(/\s+/)
          .includes("toc"),
      );
      const links = nav
        ? Array.from(nav.querySelectorAll("a[href]"))
        : Array.from(navDoc.querySelectorAll("navPoint > content"));
      for (const link of links.slice(0, MAX_NAVIGATION_ENTRIES)) {
        const href = link.getAttribute(nav ? "href" : "src");
        const label = textOf(
          nav ? link : (link.parentElement?.querySelector("navLabel > text") ?? null),
        ).replace(/\s+/g, " ");
        const location = href ? resolveBookLocation(chapters, item.href, href) : null;
        if (!location || !label) continue;
        let depth = 0;
        for (
          let parent = link.parentElement;
          parent && parent !== nav;
          parent = parent.parentElement
        ) {
          if (parent.localName === (nav ? "ol" : "navPoint")) depth++;
        }
        navigation.push({ ...location, label, depth: Math.min(8, Math.max(0, depth - 1)) });
      }
    } catch {
      // A broken TOC falls back to NCX or the imported spine chapters.
    }
  }
  const fixedLayout = Array.from(opfDoc.querySelectorAll("metadata > meta")).some(
    (el) => el.getAttribute("property") === "rendition:layout" && textOf(el) === "pre-paginated",
  );
  if (fixedLayout)
    importWarnings.push(
      "Este EPUB tem layout fixo. A versão de leitura adapta texto e imagens e pode diferir da diagramação original.",
    );

  return {
    id: newEpubId(),
    title,
    author,
    cover,
    chapters,
    ...(navigation.length ? { navigation } : {}),
    ...(importWarnings.length ? { importWarnings: [...new Set(importWarnings)] } : {}),
    epubVersion: opfDoc.documentElement.getAttribute("version") ?? "desconhecida",
  };
}
