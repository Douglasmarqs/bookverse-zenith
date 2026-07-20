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
import type { Book, Chapter } from "./sample-book";
import { newEpubId } from "./epub-store";

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

/** Extracts readable paragraphs from one chapter's (X)HTML content. */
function extractChapter(html: string, index: number): Chapter {
  const doc = parseXml(html);
  const body = doc.body ?? doc.documentElement;

  const heading = body?.querySelector("h1, h2, h3");
  const title = textOf(heading) || textOf(doc.querySelector("title")) || `Capítulo ${index + 1}`;

  const pTags = Array.from(body?.querySelectorAll("p") ?? []);
  let paragraphs = pTags
    .map((p) => (p.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    // No <p> tags (some EPUBs use <div>s per paragraph, or plain text) —
    // fall back to the raw text content split on blank lines.
    const raw = (body?.textContent ?? "").trim();
    paragraphs = raw
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 0);
  }

  return { id: `cap-${index}`, title, paragraphs };
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
      if (coverFile) {
        const base64 = await coverFile.async("base64");
        cover = `data:${guessMimeType(coverEntry.href)};base64,${base64}`;
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
  let index = 0;
  for (const idref of spineRefs) {
    const item = manifest.get(idref);
    if (!item) continue;
    // Skip non-HTML spine entries (rare, but the spec technically allows it).
    if (item.mediaType && !/html|xml/.test(item.mediaType)) continue;
    try {
      const html = await readText(zip, item.href);
      const chapter = extractChapter(html, index);
      if (chapter.paragraphs.length > 0) {
        chapters.push(chapter);
        index += 1;
      }
    } catch (err) {
      console.warn(`[epub] skipping unreadable spine item ${item.href}`, err);
    }
  }

  if (chapters.length === 0) {
    throw new EpubParseError("Não encontramos texto legível dentro deste EPUB.");
  }

  return {
    id: newEpubId(),
    title,
    author,
    cover,
    chapters,
  };
}
