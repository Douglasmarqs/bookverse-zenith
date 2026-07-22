/**
 * Public-domain reading — real, full book text for titles whose copyright
 * has expired (Machado de Assis, Eça de Queirós, etc.), sourced from
 * Project Gutenberg via the Gutendex catalog API. Runs server-side (not in
 * the browser) for two reasons:
 *   1. Avoids relying on Gutendex/Gutenberg's CORS support, which is
 *      inconsistent for direct browser fetches.
 *   2. Lets us parse + cache the parsed chapters once in Firestore instead
 *      of re-downloading/re-parsing a multi-hundred-KB text file per reader.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const GUTENDEX_BASE = "https://gutendex.com";

interface GutendexAuthor {
  name: string;
}

interface GutendexBook {
  id: number;
  title: string;
  authors: GutendexAuthor[];
  languages: string[];
  subjects: string[];
  formats: Record<string, string>;
}

export interface PublicDomainSummary {
  id: number;
  title: string;
  author: string;
  cover: string | null;
  languages: string[];
  subjects: string[];
}

function summarize(b: GutendexBook): PublicDomainSummary {
  return {
    id: b.id,
    title: b.title,
    author: b.authors?.map((a) => a.name).join(", ") || "Autor desconhecido",
    cover: b.formats["image/jpeg"] ?? null,
    languages: b.languages ?? [],
    subjects: (b.subjects ?? []).slice(0, 4),
  };
}

function pickTextUrl(formats: Record<string, string>): string | null {
  const keys = Object.keys(formats).filter((k) => k.startsWith("text/plain"));
  // Prefer utf-8, then ascii, then whatever plain-text variant exists.
  const byPref =
    keys.find((k) => k.includes("utf-8")) ?? keys.find((k) => k.includes("us-ascii")) ?? keys[0];
  return byPref ? formats[byPref] : null;
}

/** Strips the Project Gutenberg legal boilerplate that wraps every text. */
function stripBoilerplate(raw: string): string {
  const startMatch = raw.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i);
  const endMatch = raw.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i);
  const start = startMatch ? startMatch.index! + startMatch[0].length : 0;
  const end = endMatch ? endMatch.index! : raw.length;
  return raw.slice(start, end).trim();
}

interface ParsedChapter {
  id: string;
  title: string;
  paragraphs: string[];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Some Gutenberg plain-text editions hard-wrap at every clause with a blank
 * line between them (common in verse-like or numbered-maxim texts), which
 * makes naive blank-line paragraph splitting produce tiny, choppy
 * fragments like "batalha;" / "se" / "estivermos" instead of one flowing
 * sentence. This merges consecutive fragments back together until each
 * resulting paragraph actually ends in sentence-ending punctuation.
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

/**
 * Splits Gutenberg plain text into chapters. Tries common chapter markers
 * (CHAPTER/CAPÍTULO + numeral) first; falls back to fixed-size chunks so
 * even books without clean markup still read reasonably.
 */
function parseChapters(text: string): ParsedChapter[] {
  const lines = text.split(/\r?\n/);
  const markerRe = /^\s*(CHAPTER|CAPÍTULO|CAP[IÍ]TULO)\s+([0-9IVXLCDM]+)\b\.?\s*(.*)$/i;

  type Block = { title: string; lines: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const m = markerRe.exec(trimmed);
    if (m) {
      const marker = capitalize(m[1]);
      const number = m[2];
      const trailing = (m[3] ?? "").trim();
      // If there's a lot of text after the marker on the same line, it's
      // almost always the start of the chapter's body (a run-on line in
      // the source file), not a real subtitle — keep the heading clean
      // and push that text into the body instead of the title.
      const trailingIsTitle = trailing.length > 0 && trailing.length <= 60;
      current = {
        title: trailingIsTitle ? `${marker} ${number} — ${trailing}` : `${marker} ${number}`,
        lines: trailingIsTitle ? [] : trailing ? [trailing] : [],
      };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      // Content before the first detected chapter marker (preface/intro).
      if (blocks.length === 0) {
        current = { title: "Início", lines: [line] };
        blocks.push(current);
      }
    }
  }

  const toParagraphs = (raw: string[]): string[] =>
    reflowParagraphs(
      raw
        .join("\n")
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 0),
    );

  // Good chapter markers found — use them (drop empty leading blocks).
  const withContent = blocks
    .map((b, i) => ({ id: `cap-${i}`, title: b.title, paragraphs: toParagraphs(b.lines) }))
    .filter((c) => c.paragraphs.length > 0);

  // Sanity check: real chapter markers produce a handful of chapters with
  // substantial content each. If matching produced a huge number of
  // "chapters" averaging almost no paragraphs (e.g. the word "chapter"
  // appears repeatedly in a table of contents, or matched incidentally),
  // that's a false positive — prefer the fixed-size fallback instead.
  const avgParagraphsPerChapter =
    withContent.length > 0
      ? withContent.reduce((sum, c) => sum + c.paragraphs.length, 0) / withContent.length
      : 0;
  const looksReliable =
    withContent.length >= 2 && (withContent.length <= 20 || avgParagraphsPerChapter >= 2);

  if (looksReliable) return withContent;

  // Fallback: no reliable chapter markers — chunk into ~6000-character
  // sections so the reader still has manageable "chapters".
  const allParagraphs = toParagraphs(lines);
  const chunks: ParsedChapter[] = [];
  let bucket: string[] = [];
  let bucketLen = 0;
  let idx = 0;
  for (const p of allParagraphs) {
    bucket.push(p);
    bucketLen += p.length;
    if (bucketLen > 6000) {
      chunks.push({ id: `parte-${idx}`, title: `Parte ${idx + 1}`, paragraphs: bucket });
      idx += 1;
      bucket = [];
      bucketLen = 0;
    }
  }
  if (bucket.length > 0) {
    chunks.push({ id: `parte-${idx}`, title: `Parte ${idx + 1}`, paragraphs: bucket });
  }
  return chunks.length > 0
    ? chunks
    : [{ id: "unico", title: "Texto completo", paragraphs: allParagraphs }];
}

export const searchPublicDomainBooks = onCall<{ query?: string; maxResults?: number }>(
  { cors: true, maxInstances: 10 },
  async (request) => {
    const query = (request.data?.query ?? "").trim();
    if (!query) return { results: [] as PublicDomainSummary[] };

    const url = `${GUTENDEX_BASE}/books?search=${encodeURIComponent(query)}&languages=pt,en`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new HttpsError("unavailable", "Catálogo de domínio público indisponível agora.");
    }
    const data = (await res.json()) as { results: GutendexBook[] };
    const max = Math.min(request.data?.maxResults ?? 24, 40);
    return { results: data.results.slice(0, max).map(summarize) };
  },
);

export const getPublicDomainBook = onCall<{ gutenbergId: number }>(
  { cors: true, timeoutSeconds: 60, memory: "512MiB", maxInstances: 10 },
  async (request) => {
    const gutenbergId = request.data?.gutenbergId;
    if (!gutenbergId || typeof gutenbergId !== "number") {
      throw new HttpsError("invalid-argument", "gutenbergId é obrigatório.");
    }

    const db = getFirestore();
    const cacheRef = db.collection("publicDomainBooks").doc(String(gutenbergId));
    const cached = await cacheRef.get();
    if (cached.exists) return cached.data();

    const metaRes = await fetch(`${GUTENDEX_BASE}/books/${gutenbergId}`);
    if (!metaRes.ok) throw new HttpsError("not-found", "Livro não encontrado no catálogo.");
    const meta = (await metaRes.json()) as GutendexBook;

    const textUrl = pickTextUrl(meta.formats);
    if (!textUrl) {
      throw new HttpsError(
        "failed-precondition",
        "Este título não tem uma versão em texto simples disponível.",
      );
    }

    const textRes = await fetch(textUrl);
    if (!textRes.ok) throw new HttpsError("internal", "Falha ao baixar o texto do livro.");
    const raw = await textRes.text();
    const clean = stripBoilerplate(raw);
    const chapters = parseChapters(clean);

    const book = {
      id: `gutenberg-${gutenbergId}`,
      title: meta.title,
      author: meta.authors?.map((a) => a.name).join(", ") || "Autor desconhecido",
      cover: meta.formats["image/jpeg"] ?? null,
      chapters,
    };

    await cacheRef.set(book);
    return book;
  },
);
