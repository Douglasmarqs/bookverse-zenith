/**
 * Google Books integration — resolves real cover art and metadata for a
 * title/author pair. No API key required for basic volume search (subject to
 * Google's public quota); results are cached in-memory + sessionStorage so we
 * don't refetch the same title twice in a session.
 */

export interface BookMeta {
  title: string;
  author: string;
  cover: string | null;
  description?: string;
  previewLink?: string;
  averageRating?: number;
  ratingsCount?: number;
  categories?: string[];
}

const CACHE_PREFIX = "bookverse:gbooks:";
const memCache = new Map<string, BookMeta | null>();

function cacheKey(title: string, author?: string) {
  return `${title.trim().toLowerCase()}::${(author ?? "").trim().toLowerCase()}`;
}

function readSessionCache(key: string): BookMeta | null | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as BookMeta | null;
  } catch {
    return undefined;
  }
}

function writeSessionCache(key: string, value: BookMeta | null) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full/unavailable — ignore, mem cache still works
  }
}

/** Upgrades a Google Books thumbnail to a larger, https, non-curl image. */
function upgradeCoverUrl(url: string): string {
  return url
    .replace("http://", "https://")
    .replace("zoom=1", "zoom=2")
    .replace("&edge=curl", "");
}

/**
 * Looks up a single book's real cover + metadata by title (and optionally
 * author, which improves match accuracy). Returns null if nothing is found —
 * callers should fall back to a placeholder cover in that case.
 */
export async function fetchBookMeta(
  title: string,
  author?: string,
): Promise<BookMeta | null> {
  const key = cacheKey(title, author);
  if (memCache.has(key)) return memCache.get(key)!;

  const cached = readSessionCache(key);
  if (cached !== undefined) {
    memCache.set(key, cached);
    return cached;
  }

  try {
    const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      q,
    )}&maxResults=1&printType=books`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = await res.json();
    const item = data.items?.[0];
    const info = item?.volumeInfo;

    const meta: BookMeta | null = info
      ? {
          title: info.title ?? title,
          author: info.authors?.join(", ") ?? author ?? "",
          cover: info.imageLinks?.thumbnail
            ? upgradeCoverUrl(info.imageLinks.thumbnail)
            : null,
          description: info.description,
          previewLink: info.previewLink,
          averageRating: info.averageRating,
          ratingsCount: info.ratingsCount,
          categories: info.categories,
        }
      : null;

    memCache.set(key, meta);
    writeSessionCache(key, meta);
    return meta;
  } catch (err) {
    console.warn("[google-books] lookup failed", err);
    memCache.set(key, null);
    return null;
  }
}

/** Maps our (Portuguese) category chips to query terms that actually return
 * results from Google Books — the `subject:` operator only matches Google's
 * internal (mostly English) subject taxonomy, so a literal `subject:Ficção`
 * matches almost nothing. Plain keywords in the free-text query work far
 * better and still bias results toward the right shelf. */
const CATEGORY_QUERY: Record<string, string> = {
  "Ficção": "ficção",
  "Clássicos": "clássicos da literatura",
  "Ficção científica": "ficção científica",
  "Poesia": "poesia",
  "Ensaios": "ensaios",
  "Filosofia": "filosofia",
  "Biografias": "biografia",
  "Romance": "romance",
  "Mistério": "mistério suspense",
};

export interface BookSearchResult {
  results: BookMeta[];
  /** True when the request itself failed (network/CORS/quota) — distinct
   * from a request that succeeded but matched nothing. */
  networkError: boolean;
}

/** Full-text search across Google Books — used by the "Descobrir" catalog. */
export async function searchBooks(
  query: string,
  opts: { category?: string; maxResults?: number } = {},
): Promise<BookSearchResult> {
  const trimmed = query.trim();
  const categoryTerm = opts.category ? CATEGORY_QUERY[opts.category] ?? opts.category : "";

  const parts: string[] = [];
  if (trimmed) parts.push(trimmed);
  if (categoryTerm && categoryTerm !== trimmed) parts.push(categoryTerm);

  const q = parts.join(" ").trim();
  if (!q) return { results: [], networkError: false };

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      q,
    )}&maxResults=${opts.maxResults ?? 24}&printType=books`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = await res.json();
    const items = (data.items ?? []) as any[];
    const results = items
      .filter((it) => it.volumeInfo?.title)
      .map((it) => {
        const info = it.volumeInfo;
        return {
          title: info.title as string,
          author: (info.authors?.join(", ") as string) ?? "Autor desconhecido",
          cover: info.imageLinks?.thumbnail ? upgradeCoverUrl(info.imageLinks.thumbnail) : null,
          description: info.description,
          previewLink: info.previewLink,
          averageRating: info.averageRating,
          ratingsCount: info.ratingsCount,
          categories: info.categories,
        } satisfies BookMeta;
      });
    return { results, networkError: false };
  } catch (err) {
    console.warn("[google-books] search failed", err);
    return { results: [], networkError: true };
  }
}
