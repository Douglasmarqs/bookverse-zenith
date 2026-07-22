/**
 * Client for public-domain books with real, full text.
 *
 * Tries the `searchPublicDomainBooks` / `getPublicDomainBook` Cloud
 * Functions first (see /functions/src/public-domain.ts) — server-side
 * fetch + Firestore caching, the most efficient path. If those aren't
 * reachable (not deployed yet, or Cloud Functions themselves down), falls
 * back to fetching Gutendex + Project Gutenberg directly from the browser
 * and parsing chapters locally, so reading keeps working either way. The
 * direct text download can occasionally be blocked by a Gutenberg mirror
 * that doesn't set CORS headers — if so, this throws a clear error rather
 * than hanging (the reader page already shows that error to the user).
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase } from "./firebase";
import type { Book, Chapter } from "./sample-book";

export interface PublicDomainSummary {
  id: number;
  title: string;
  author: string;
  cover: string | null;
  languages: string[];
  subjects: string[];
}

const LANGUAGE_LABELS: Record<string, string> = {
  pt: "Português",
  en: "Inglês",
  es: "Espanhol",
  fr: "Francês",
  de: "Alemão",
  it: "Italiano",
  la: "Latim",
  nl: "Neerlandês",
  ru: "Russo",
  ja: "Japonês",
  zh: "Chinês",
  el: "Grego",
  eo: "Esperanto",
  fi: "Finlandês",
  he: "Hebraico",
  hu: "Húngaro",
  pl: "Polonês",
  sv: "Sueco",
  tl: "Tagalo",
  ca: "Catalão",
  cs: "Tcheco",
  da: "Dinamarquês",
  bg: "Búlgaro",
  sr: "Sérvio",
  nb: "Norueguês",
  ro: "Romeno",
};

/** Human-readable label for a Gutenberg book's primary language — used to
 * show a language badge on public-domain cards, since search results mix
 * Portuguese and English (and occasionally other languages). */
export function primaryLanguageLabel(languages: string[]): string {
  const code = languages?.[0];
  if (!code) return "Idioma desconhecido";
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

export function gutenbergReaderId(id: number): string {
  return `gutenberg-${id}`;
}

export function parseGutenbergReaderId(bookId: string): number | null {
  const m = /^gutenberg-(\d+)$/.exec(bookId);
  return m ? Number(m[1]) : null;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
function parseChapters(text: string): Chapter[] {
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
    } else if (blocks.length === 0) {
      current = { title: "Início", lines: [line] };
      blocks.push(current);
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

  const withContent: Chapter[] = blocks
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

  const allParagraphs = toParagraphs(lines);
  const chunks: Chapter[] = [];
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

async function directSearchPublicDomain(
  query: string,
  maxResults: number,
): Promise<PublicDomainSummary[]> {
  const url = `${GUTENDEX_BASE}/books?search=${encodeURIComponent(query)}&languages=pt,en`;
  const res = await fetchWithTimeout(url, 9000);
  if (!res.ok) throw new Error(`Gutendex ${res.status}`);
  const data = (await res.json()) as { results: GutendexBook[] };
  return (data.results ?? []).slice(0, maxResults).map(summarize);
}

async function directGetPublicDomainBook(gutenbergId: number): Promise<Book> {
  const metaRes = await fetchWithTimeout(`${GUTENDEX_BASE}/books/${gutenbergId}`, 9000);
  if (!metaRes.ok) throw new Error("Livro não encontrado no catálogo.");
  const meta = (await metaRes.json()) as GutendexBook;

  const textUrl = pickTextUrl(meta.formats);
  if (!textUrl) {
    throw new Error("Este título não tem uma versão em texto simples disponível.");
  }

  const textRes = await fetchWithTimeout(textUrl, 25000);
  if (!textRes.ok) throw new Error("Falha ao baixar o texto do livro.");
  const raw = await textRes.text();
  const clean = stripBoilerplate(raw);
  const chapters = parseChapters(clean);

  return {
    id: gutenbergReaderId(gutenbergId),
    title: meta.title,
    author: meta.authors?.map((a) => a.name).join(", ") || "Autor desconhecido",
    cover: meta.formats["image/jpeg"] ?? null,
    chapters,
  };
}

export async function searchPublicDomainBooks(
  query: string,
  maxResults = 12,
): Promise<PublicDomainSummary[]> {
  if (!query.trim()) return [];

  const fb = getFirebase();
  if (fb) {
    try {
      const fn = httpsCallable<
        { query: string; maxResults?: number },
        { results: PublicDomainSummary[] }
      >(getFunctions(fb.app), "searchPublicDomainBooks");
      const res = await fn({ query, maxResults });
      return res.data.results ?? [];
    } catch (err) {
      console.warn(
        "[public-domain] cloud function search failed, falling back to direct fetch",
        err,
      );
    }
  }

  try {
    return await directSearchPublicDomain(query, maxResults);
  } catch (err) {
    console.warn("[public-domain] direct search failed", err);
    return [];
  }
}

export async function getPublicDomainBook(gutenbergId: number): Promise<Book> {
  const fb = getFirebase();
  if (fb) {
    try {
      const fn = httpsCallable<{ gutenbergId: number }, Book>(
        getFunctions(fb.app),
        "getPublicDomainBook",
      );
      const res = await fn({ gutenbergId });
      return res.data;
    } catch (err) {
      console.warn(
        "[public-domain] cloud function fetch failed, falling back to direct fetch",
        err,
      );
    }
  }
  // Let this throw — the reader page already shows a clear error if it
  // rejects, and there's no useful fallback beyond this.
  return directGetPublicDomainBook(gutenbergId);
}
