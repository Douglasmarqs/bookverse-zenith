/**
 * Turns any supported file into a book the reader can open.
 *
 * EPUB, MOBI/AZW3 (DRM-free), FB2, CBZ (comics) and TXT become a
 * reflowable `Book` (stored like an EPUB, so it opens offline and syncs);
 * PDF keeps its own store with both the original pages and the extracted
 * "modo leitura" text. Everything runs in the browser — files never leave
 * the device unless the reader is signed in (private cloud copy).
 */
import type { Book, Chapter, ChapterBlock } from "./sample-book";
import { newEpubId } from "./epub-store";
import type { PdfBook } from "./pdf-store";

export const MAX_IMPORT_BYTES = 60 * 1024 * 1024;

export type ImportKind = "epub" | "pdf" | "mobi" | "fb2" | "cbz" | "txt";

export const IMPORT_ACCEPT =
  ".epub,.pdf,.mobi,.azw3,.azw,.prc,.fb2,.cbz,.txt,application/epub+zip,application/pdf,application/x-mobipocket-ebook,text/plain";

export const KIND_LABEL: Record<ImportKind, string> = {
  epub: "EPUB",
  pdf: "PDF",
  mobi: "MOBI",
  fb2: "FB2",
  cbz: "CBZ",
  txt: "TXT",
};

export function kindOf(file: { name: string; type?: string }): ImportKind | null {
  const n = file.name.toLowerCase();
  if (n.endsWith(".epub") || file.type === "application/epub+zip") return "epub";
  if (n.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (/\.(mobi|azw3?|prc)$/.test(n)) return "mobi";
  if (n.endsWith(".fb2")) return "fb2";
  if (n.endsWith(".cbz")) return "cbz";
  if (n.endsWith(".txt") || file.type === "text/plain") return "txt";
  return null;
}

export type Converted = { type: "book"; book: Book } | { type: "pdf"; pdf: PdfBook };

const titleFromName = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Livro sem título";

/* ------------------------------ images ------------------------------ */

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Downscales an image so books stay small enough for phones. */
async function shrinkImage(
  src: Blob | string,
  maxDim = 1400,
  quality = 0.82,
): Promise<string | null> {
  try {
    const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return typeof src === "string" && src.startsWith("data:") ? src : null;
  }
}

/* ------------------------------ helpers ----------------------------- */

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** HTML → chapter (paragraphs + images in reading order). */
async function htmlToChapter(
  html: string,
  index: number,
  budget: { images: number },
): Promise<Chapter> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  const title = clean(body.querySelector("h1, h2, h3")?.textContent) || `Capítulo ${index + 1}`;
  const paragraphs: string[] = [];
  const blocks: ChapterBlock[] = [];
  const nodes = Array.from(body.querySelectorAll("p, img, h1, h2, h3, h4, blockquote > div, li"));
  const source = nodes.length ? nodes : [];
  for (const el of source) {
    const tag = el.tagName.toLowerCase();
    if (tag === "img") {
      const src = el.getAttribute("src");
      if (src && budget.images > 0) {
        const data = await shrinkImage(src, 1200);
        if (data) {
          budget.images -= 1;
          blocks.push({ type: "image", src: data, alt: el.getAttribute("alt") ?? undefined });
        }
      }
      continue;
    }
    if (/^h[1-4]$/.test(tag) && clean(el.textContent) === title) continue;
    const text = clean(el.textContent);
    if (!text) continue;
    paragraphs.push(text);
    blocks.push({ type: "text", paragraphIndex: paragraphs.length - 1 });
  }
  if (!paragraphs.length) {
    for (const p of clean(body.textContent).split(/(?<=[.!?…])\s{2,}/)) {
      if (!p) continue;
      paragraphs.push(p);
      blocks.push({ type: "text", paragraphIndex: paragraphs.length - 1 });
    }
  }
  return { id: `cap-${index}`, title, paragraphs, blocks };
}

const meaningful = (c: Chapter) =>
  c.paragraphs.join(" ").length > 40 || (c.blocks ?? []).some((b) => b.type === "image");

/* ------------------------------ formats ----------------------------- */

async function fromMobi(file: File): Promise<Book> {
  const mod = await import("@lingo-reader/mobi-parser");
  const bytes = new Uint8Array(await file.arrayBuffer());
  type Parser = {
    getSpine: () => { id: string }[];
    loadChapter: (
      id: string,
    ) => { html: string } | undefined | Promise<{ html: string } | undefined>;
    getMetadata: () => { title?: string; author?: string[] | string; creator?: string[] };
    getCoverImage: () => string;
    destroy: () => void;
  };
  // AZW3 is KF8; .mobi is usually MOBI 6 (sometimes with a KF8 part).
  const order = /\.azw3$/i.test(file.name)
    ? [mod.initKf8File, mod.initMobiFile]
    : [mod.initMobiFile, mod.initKf8File];
  let parser: Parser | null = null;
  for (const init of order) {
    try {
      const p = (await init(bytes)) as unknown as Parser;
      if (p.getSpine().length) {
        parser = p;
        break;
      }
      p.destroy();
    } catch {
      // try the other layout
    }
  }
  if (!parser) {
    throw new Error("Não conseguimos abrir este arquivo. Ele pode estar protegido (DRM).");
  }
  try {
    const meta = parser.getMetadata();
    const authors = meta.author ?? meta.creator ?? [];
    const budget = { images: 80 };
    const chapters: Chapter[] = [];
    for (const [i, item] of parser.getSpine().entries()) {
      const ch = await parser.loadChapter(item.id);
      if (!ch?.html) continue;
      const c = await htmlToChapter(ch.html, i, budget);
      if (meaningful(c)) chapters.push({ ...c, id: `cap-${chapters.length}` });
    }
    let cover: string | null = null;
    try {
      const url = parser.getCoverImage();
      if (url) cover = await shrinkImage(url, 600);
    } catch {
      // no cover
    }
    if (!chapters.length)
      throw new Error("Não encontramos texto neste arquivo. Ele pode estar protegido (DRM).");
    return {
      id: newEpubId(),
      title: clean(meta.title) || titleFromName(file.name),
      author: clean(Array.isArray(authors) ? authors.join(", ") : authors) || "Autor desconhecido",
      cover,
      chapters,
    };
  } finally {
    parser.destroy();
  }
}

async function fromFb2(file: File): Promise<Book> {
  const raw = await file.text();
  const doc = new DOMParser().parseFromString(raw, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Este FB2 parece estar corrompido.");
  const pick = (root: Element | Document, sel: string) =>
    clean(root.querySelector(sel)?.textContent);
  const info = doc.querySelector("description title-info") ?? doc;
  const authorEl = info.querySelector("author");
  const author = authorEl
    ? [pick(authorEl, "first-name"), pick(authorEl, "middle-name"), pick(authorEl, "last-name")]
        .filter(Boolean)
        .join(" ")
    : "";
  // Cover: <coverpage><image l:href="#cover.jpg"/> → <binary id="cover.jpg">.
  let cover: string | null = null;
  const coverRef = info.querySelector("coverpage image");
  const href =
    coverRef?.getAttribute("l:href") ??
    coverRef?.getAttribute("xlink:href") ??
    coverRef?.getAttributeNS("http://www.w3.org/1999/xlink", "href");
  if (href) {
    const bin = Array.from(doc.querySelectorAll("binary")).find(
      (b) => b.getAttribute("id") === href.replace(/^#/, ""),
    );
    if (bin)
      cover = await shrinkImage(
        `data:${bin.getAttribute("content-type") ?? "image/jpeg"};base64,${clean(bin.textContent)}`,
        600,
      );
  }
  const body =
    Array.from(doc.querySelectorAll("body")).find((b) => b.getAttribute("name") !== "notes") ??
    doc.querySelector("body");
  const sections = Array.from(body?.querySelectorAll("section") ?? []).filter((s) =>
    Array.from(s.children).some((c) => ["p", "poem", "cite", "subtitle"].includes(c.tagName)),
  );
  const chapters: Chapter[] = sections.map((s, i) => {
    const title =
      clean(Array.from(s.children).find((c) => c.tagName === "title")?.textContent) ||
      `Capítulo ${i + 1}`;
    const paragraphs = Array.from(s.children)
      .filter((c) => c.tagName !== "title" && c.tagName !== "section")
      .flatMap((c) =>
        c.tagName === "poem"
          ? Array.from(c.querySelectorAll("v")).map((v) => clean(v.textContent))
          : [clean(c.textContent)],
      )
      .filter(Boolean);
    return { id: `cap-${i}`, title, paragraphs };
  });
  if (!chapters.length) throw new Error("Não encontramos capítulos neste FB2.");
  return {
    id: newEpubId(),
    title: pick(info, "book-title") || titleFromName(file.name),
    author: author || "Autor desconhecido",
    cover,
    chapters,
  };
}

async function fromCbz(file: File): Promise<Book> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files)
    .filter((n) => !zip.files[n]!.dir && /\.(jpe?g|png|webp|gif)$/i.test(n) && !/__MACOSX/.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 400);
  if (!names.length) throw new Error("Este CBZ não tem imagens.");
  const pages: string[] = [];
  for (const n of names) {
    const data = await shrinkImage(await zip.files[n]!.async("blob"), 1600, 0.85);
    if (data) pages.push(data);
  }
  const per = 20;
  const chapters: Chapter[] = [];
  for (let i = 0; i < pages.length; i += per) {
    const slice = pages.slice(i, i + per);
    chapters.push({
      id: `cap-${chapters.length}`,
      title: `Páginas ${i + 1}–${i + slice.length}`,
      paragraphs: [],
      blocks: slice.map((src, k) => ({ type: "image" as const, src, alt: `Página ${i + k + 1}` })),
    });
  }
  return {
    id: newEpubId(),
    title: titleFromName(file.name),
    author: "Quadrinhos",
    cover: pages[0] ?? null,
    chapters,
  };
}

async function fromTxt(file: File): Promise<Book> {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  if ((text.match(/�/g)?.length ?? 0) > 20) text = new TextDecoder("windows-1252").decode(buf);
  text = text.replace(/\r\n?/g, "\n");
  const blocks = /\n\s*\n/.test(text) ? text.split(/\n\s*\n+/) : text.split("\n");
  const paras = blocks.map((b) => b.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const heading = /^(cap[ií]tulo|chapter|parte|part|livro)\b.{0,60}$|^[IVXLC]{1,7}\.?$/i;
  const chapters: Chapter[] = [];
  let cur: Chapter = { id: "cap-0", title: "Início", paragraphs: [] };
  for (const p of paras) {
    if (heading.test(p) && p.length < 70) {
      if (cur.paragraphs.length) chapters.push(cur);
      cur = { id: `cap-${chapters.length}`, title: p, paragraphs: [] };
    } else {
      cur.paragraphs.push(p);
    }
  }
  if (cur.paragraphs.length) chapters.push(cur);
  // No headings found: split into reading-sized parts.
  const out =
    chapters.length > 1
      ? chapters
      : Array.from({ length: Math.ceil(paras.length / 60) }, (_, i) => ({
          id: `cap-${i}`,
          title: `Parte ${i + 1}`,
          paragraphs: paras.slice(i * 60, i * 60 + 60),
        }));
  if (!out.length) throw new Error("O arquivo de texto está vazio.");
  return {
    id: newEpubId(),
    title: titleFromName(file.name),
    author: "Documento pessoal",
    cover: null,
    chapters: out.map((c, i) => ({ ...c, id: `cap-${i}` })),
  };
}

/** Converts one file. `onStage` reports human-readable progress steps. */
export async function convertFile(
  file: File,
  onStage?: (stage: string) => void,
): Promise<Converted> {
  const kind = kindOf(file);
  if (!kind) throw new Error("Formato não suportado. Use EPUB, PDF, MOBI, AZW3, FB2, CBZ ou TXT.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("O arquivo precisa ter no máximo 60 MB.");
  onStage?.(
    kind === "pdf"
      ? "Extraindo texto para modo leitura…"
      : kind === "mobi"
        ? "Convertendo para o leitor…"
        : "Lendo capítulos…",
  );
  switch (kind) {
    case "epub": {
      const { parseEpubFile } = await import("./epub-parser");
      return { type: "book", book: await parseEpubFile(file) };
    }
    case "pdf": {
      const { createPdfBook } = await import("./pdf-store");
      return { type: "pdf", pdf: await createPdfBook(file) };
    }
    case "mobi":
      return { type: "book", book: await fromMobi(file) };
    case "fb2":
      return { type: "book", book: await fromFb2(file) };
    case "cbz":
      return { type: "book", book: await fromCbz(file) };
    case "txt":
      return { type: "book", book: await fromTxt(file) };
  }
}

export { blobToDataUrl };
