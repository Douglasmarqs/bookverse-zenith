/**
 * Our own Project Gutenberg search. gutenberg.org and Gutendex turn cloud
 * servers away, but the official PGLAF mirrors publish the whole catalogue
 * (pg_catalog.csv.gz, ~5 MB, ~75k titles). We fetch it once per server
 * instance, keep a compact index in memory and search it locally.
 */
import { gunzipSync } from "node:zlib";

import { cleanTitle, niceAuthor, norm, type CatalogBook } from "@/lib/catalog-shared";

interface Row {
  id: string;
  title: string;
  author: string;
  lang: string;
  /** Normalised "title author" for matching. */
  hay: string;
  /** Normalised title alone, for ranking. */
  t: string;
}

const FEEDS = [
  // Tests can point at a local copy of the feed.
  ...(process.env.PG_CATALOG_FEED ? [process.env.PG_CATALOG_FEED] : []),
  "https://gutenberg.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz",
  "https://aleph.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz",
];
const UA = "BookVerse/1.0 (+https://bookverse-zenith.vercel.app)";
const TTL = 12 * 60 * 60 * 1000;

let cache: { at: number; rows: Promise<Row[]> } | null = null;

/** Minimal RFC-4180 CSV parser (quotes, doubled quotes, newlines in cells). */
function parseCsv(text: string, onRow: (cells: string[]) => void) {
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      cells.push(cell);
      cell = "";
    } else if (c === "\n") {
      cells.push(cell);
      onRow(cells);
      cells = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || cells.length) {
    cells.push(cell);
    onRow(cells);
  }
}

async function download(): Promise<Buffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    return await Promise.any(
      FEEDS.map(async (url) => {
        const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
        if (!r.ok) throw new Error(String(r.status));
        return Buffer.from(await r.arrayBuffer());
      }),
    );
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
}

async function build(): Promise<Row[]> {
  const gz = await download();
  const text = gunzipSync(gz).toString("utf8");
  const rows: Row[] = [];
  let header = true;
  parseCsv(text, (c) => {
    if (header) {
      header = false;
      return;
    }
    // Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves
    const [id, type, , rawTitle = "", lang = "", authors = ""] = c;
    if (!id || type !== "Text" || !/^\d+$/.test(id)) return;
    // "Camões, Luís de, 1524?-1580 [Translator]" → "Camões, Luís de"
    const first = (authors.split(";")[0] ?? "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(
        /,\s*(?:ca\.\s*)?-?\d{1,4}\??\s*(?:BCE)?\s*-?\s*(?:ca\.\s*)?\d{0,4}\??\s*(?:BCE)?\s*$/i,
        "",
      )
      .trim();
    const author = first ? niceAuthor(first) : "Autor desconhecido";
    const title = rawTitle.replace(/\s+/g, " ").trim();
    if (!title) return;
    const t = norm(title);
    rows.push({
      id,
      title,
      author,
      lang: lang.split(";")[0]!.trim(),
      hay: `${t} ${norm(author)}`,
      t,
    });
  });
  return rows;
}

function index(): Promise<Row[]> {
  if (!cache || Date.now() - cache.at > TTL) {
    const rows = build();
    cache = { at: Date.now(), rows };
    rows.catch(() => {
      cache = null; // try again on the next search
    });
  }
  return cache.rows;
}

/** Warm the index without waiting (e.g. on the first search of an instance). */
export function warmGutenbergIndex() {
  void index().catch(() => {});
}

export async function searchGutenbergIndex(q: string, limit = 16): Promise<CatalogBook[]> {
  const terms = norm(q)
    .split(" ")
    .filter((w) => w.length > 1);
  if (!terms.length) return [];
  const rows = await index();
  const nq = terms.join(" ");
  const scored: { r: Row; s: number }[] = [];
  for (const r of rows) {
    if (!terms.every((w) => r.hay.includes(w))) continue;
    let s = 0;
    if (r.t === nq) s += 100;
    else if (r.t.startsWith(nq)) s += 60;
    else if (r.t.includes(nq)) s += 35;
    if (terms.every((w) => r.t.includes(w))) s += 20;
    if (r.lang === "pt") s += 15;
    else if (r.lang === "en") s += 6;
    s -= Math.min(10, r.t.length / 30); // shorter, cleaner titles first
    scored.push({ r, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map(({ r }) => ({
    key: `gutenberg:${r.id}`,
    source: "gutenberg" as const,
    id: r.id,
    title: cleanTitle(r.title.split(/[:;]/)[0]!, r.author),
    author: r.author,
    language: r.lang || null,
    cover: `https://www.gutenberg.org/cache/epub/${r.id}/pg${r.id}.cover.medium.jpg`,
    readerId: `gutenberg-${r.id}`,
  }));
}
