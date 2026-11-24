/**
 * Free-books catalogue — types and ranking shared by the server search and
 * the browser (which queries Wikisource directly, on each reader's own
 * quota, because Wikimedia rate-limits shared server addresses).
 */

export type CatalogSource = "gutenberg" | "wikisource" | "standard" | "archive";

export interface CatalogBook {
  key: string;
  source: CatalogSource;
  id: string;
  title: string;
  author: string;
  year?: number | null;
  /** ISO-ish 2-letter code when known ("pt", "en"…). */
  language?: string | null;
  cover?: string | null;
  /** Opens instantly in the reader without downloading (Gutenberg). */
  readerId?: string | null;
  downloads?: number | null;
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Dickens, Charles, 1812-1870" → "Charles Dickens". */
export function niceAuthor(name: string): string {
  const clean = name
    .replace(/,?\s*\d{3,4}\s*-\s*\d{0,4}\.?/g, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  const m = clean.match(/^([^,;]+),\s*([^,;]+)$/);
  return (m ? `${m[2]!.trim()} ${m[1]!.trim()}` : clean.split(";")[0]!).trim() || name.trim();
}

/** Drops " - Author", "(1899)" and similar noise from catalogue titles. */
export function cleanTitle(title: string, author = ""): string {
  let t = title.replace(/\s+/g, " ").trim();
  if (author) {
    const a = author.split(" ").pop() ?? "";
    t = t.replace(
      new RegExp(`\\s*[-–—:]\\s*${author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "i"),
      "",
    );
    if (a.length > 3)
      t = t.replace(new RegExp(`\\s+${author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "");
  }
  t = t.replace(/\s*\((\d{4}|vers[aã]o [^)]*)\)\s*$/i, "").trim();
  return t || title.trim();
}

const SOURCE_WEIGHT: Record<CatalogSource, number> = {
  gutenberg: 3,
  standard: 2.5,
  wikisource: 2,
  archive: 1,
};

/** Relevance + Portuguese first + one copy per book. */
export function rankCatalog(all: CatalogBook[], q: string, lang?: string | null): CatalogBook[] {
  const nq = norm(q);
  const terms = nq
    .split(" ")
    .filter((x) => x.length > 1 && !["de", "da", "do", "o", "a", "e"].includes(x));
  const scored = all.flatMap((b) => {
    const t = norm(b.title);
    const au = norm(b.author);
    const inTitle = terms.filter((x) => t.includes(x)).length;
    const inAuthor = terms.filter((x) => au.includes(x)).length;
    // Must actually be about the query (titles or authors, not body text).
    if (terms.length && inTitle + inAuthor === 0) return [];
    let score = SOURCE_WEIGHT[b.source];
    if (t === nq) score += 6;
    else if (t.startsWith(nq)) score += 4;
    score += inTitle * 1.2 + inAuthor;
    if (b.language === "pt") score += 2.5;
    if (lang && b.language === lang) score += 3;
    if (b.cover) score += 0.3;
    if (b.downloads) score += Math.min(2, Math.log10(b.downloads + 1) / 2);
    return [{ b, score }];
  });
  const seen = new Map<string, { b: CatalogBook; score: number }>();
  for (const s of scored) {
    const k = `${norm(s.b.title).slice(0, 40)}|${norm(s.b.author).split(" ").pop()}`;
    const prev = seen.get(k);
    if (!prev || s.score > prev.score) seen.set(k, s);
  }
  return [...seen.values()]
    .filter((s) => !lang || !s.b.language || s.b.language === lang)
    .sort((x, y) => y.score - x.score)
    .map((s) => s.b)
    .slice(0, 40);
}

/** Parses a Wikisource search response into books. */
export function parseWikisource(data: {
  query?: { search: { title: string; snippet: string; wordcount: number }[] };
}): CatalogBook[] {
  const decode = (s: string) =>
    s
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .trim();
  return (data?.query?.search ?? [])
    .filter((r) => !r.title.includes("/") && r.wordcount > 400)
    .slice(0, 10)
    .map((r) => {
      const snippet = decode(r.snippet);
      const by = snippet.match(
        /\bpor\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ.' ]{2,40}?)(?=\s*\d|\s{2}|\s+[A-Z]{3}|$)/,
      );
      return {
        key: `wikisource:${r.title}`,
        source: "wikisource" as const,
        id: r.title,
        title: r.title,
        author: by?.[1]?.trim() || "Wikisource",
        language: "pt",
        cover: null,
      };
    });
}
