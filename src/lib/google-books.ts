/**
 * Google Books integration — resolves real cover art and metadata for a
 * title/author pair.
 *
 * Requests go through the `getGoogleBookMeta` / `searchGoogleBooks` Cloud
 * Functions first (server-side egress is reliable everywhere), and only
 * fall back to a direct browser fetch if Firebase/Functions aren't
 * available. This two-layer approach means the catalog keeps working even
 * when the visitor's network/browser blocks direct calls to
 * `googleapis.com` (a common side-effect of ad/privacy blockers and some
 * corporate networks) — see DEPLOY.md item 2 for the original symptom.
 *
 * Results are cached in-memory + sessionStorage so we don't refetch the
 * same title twice in a session.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase } from "./firebase";

export interface BookMeta {
  title: string;
  author: string;
  cover: string | null;
  description?: string;
  previewLink?: string;
  averageRating?: number;
  ratingsCount?: number;
  categories?: string[];
  /** Set when this title can be read in-app (public-domain full text).
   * Points at the `/reader/$bookId` id — see `public-domain.ts`. */
  readerId?: string | null;
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
  return url.replace("http://", "https://").replace("zoom=1", "zoom=2").replace("&edge=curl", "");
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

/** Maps our (Portuguese) category chips to query terms that actually return
 * results from Google Books — the `subject:` operator only matches Google's
 * internal (mostly English) subject taxonomy, so a literal `subject:Ficção`
 * matches almost nothing. Plain keywords in the free-text query work far
 * better and still bias results toward the right shelf. */
const CATEGORY_QUERY: Record<string, string> = {
  Ficção: "ficção",
  Clássicos: "clássicos da literatura",
  "Ficção científica": "ficção científica",
  Poesia: "poesia",
  Ensaios: "ensaios",
  Filosofia: "filosofia",
  Biografias: "biografia",
  Romance: "romance",
  Mistério: "mistério suspense",
};

export interface BookSearchResult {
  results: BookMeta[];
  /** True when the request itself failed (network/CORS/quota) — distinct
   * from a request that succeeded but matched nothing. */
  networkError: boolean;
}

// ---------------------------------------------------------------------------
// Direct-fetch fallback (used only if the Cloud Function path is unavailable)
// ---------------------------------------------------------------------------

async function directFetchMeta(title: string, author?: string): Promise<BookMeta | null> {
  const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
    q,
  )}&maxResults=1&printType=books`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const data = (await res.json()) as { items?: GoogleVolumeItem[] };
  const info = data.items?.[0]?.volumeInfo;
  return info
    ? {
        title: info.title ?? title,
        author: info.authors?.join(", ") ?? author ?? "",
        cover: info.imageLinks?.thumbnail ? upgradeCoverUrl(info.imageLinks.thumbnail) : null,
        description: info.description,
        previewLink: info.previewLink,
        averageRating: info.averageRating,
        ratingsCount: info.ratingsCount,
        categories: info.categories,
      }
    : null;
}

interface GoogleVolumeInfo {
  title?: string;
  authors?: string[];
  imageLinks?: { thumbnail?: string };
  description?: string;
  previewLink?: string;
  averageRating?: number;
  ratingsCount?: number;
  categories?: string[];
}

interface GoogleVolumeItem {
  volumeInfo?: GoogleVolumeInfo;
}

async function directSearchBooks(
  query: string,
  category?: string,
  maxResults = 24,
): Promise<BookMeta[]> {
  const categoryTerm = category ? (CATEGORY_QUERY[category] ?? category) : "";
  const parts: string[] = [];
  if (query) parts.push(query);
  if (categoryTerm && categoryTerm !== query) parts.push(categoryTerm);
  const q = parts.join(" ").trim();
  if (!q) return [];

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
    q,
  )}&maxResults=${maxResults}&printType=books`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const data = (await res.json()) as { items?: GoogleVolumeItem[] };
  const items = data.items ?? [];
  return items
    .filter((it) => it.volumeInfo?.title)
    .map((it) => {
      const info = it.volumeInfo as GoogleVolumeInfo;
      return {
        title: info.title as string,
        author: info.authors?.join(", ") ?? "Autor desconhecido",
        cover: info.imageLinks?.thumbnail ? upgradeCoverUrl(info.imageLinks.thumbnail) : null,
        description: info.description,
        previewLink: info.previewLink,
        averageRating: info.averageRating,
        ratingsCount: info.ratingsCount,
        categories: info.categories,
      } satisfies BookMeta;
    });
}

// ---------------------------------------------------------------------------
// Public API — Cloud Function first, direct fetch fallback
// ---------------------------------------------------------------------------

/**
 * Looks up a single book's real cover + metadata by title (and optionally
 * author, which improves match accuracy). Returns null if nothing is found —
 * callers should fall back to a placeholder cover in that case.
 */
export async function fetchBookMeta(title: string, author?: string): Promise<BookMeta | null> {
  const key = cacheKey(title, author);
  if (memCache.has(key)) return memCache.get(key)!;

  const cached = readSessionCache(key);
  if (cached !== undefined) {
    memCache.set(key, cached);
    return cached;
  }

  let meta: BookMeta | null = null;
  let resolved = false;

  const fb = getFirebase();
  if (fb) {
    try {
      const fn = httpsCallable<{ title: string; author?: string }, { meta: BookMeta | null }>(
        getFunctions(fb.app),
        "getGoogleBookMeta",
      );
      const res = await fn({ title, author });
      meta = res.data.meta;
      resolved = true;
    } catch (err) {
      console.warn(
        "[google-books] cloud function lookup failed, falling back to direct fetch",
        err,
      );
    }
  }

  if (!resolved) {
    try {
      meta = await directFetchMeta(title, author);
    } catch (err) {
      console.warn("[google-books] direct lookup failed", err);
      meta = null;
    }
  }

  memCache.set(key, meta);
  writeSessionCache(key, meta);
  return meta;
}

/** Full-text search across Google Books — used by the "Descobrir" catalog. */
export async function searchBooks(
  query: string,
  opts: { category?: string; maxResults?: number } = {},
): Promise<BookSearchResult> {
  const trimmed = query.trim();
  if (!trimmed && !opts.category) return { results: [], networkError: false };

  const fb = getFirebase();
  if (fb) {
    try {
      const fn = httpsCallable<
        { query: string; category?: string; maxResults?: number },
        { results: BookMeta[]; error?: boolean }
      >(getFunctions(fb.app), "searchGoogleBooks");
      const res = await fn({
        query: trimmed,
        category: opts.category,
        maxResults: opts.maxResults,
      });
      return {
        results: res.data.results,
        networkError: !!res.data.error && res.data.results.length === 0,
      };
    } catch (err) {
      console.warn(
        "[google-books] cloud function search failed, falling back to direct fetch",
        err,
      );
    }
  }

  try {
    const results = await directSearchBooks(trimmed, opts.category, opts.maxResults ?? 24);
    return { results, networkError: false };
  } catch (err) {
    console.warn("[google-books] direct search failed", err);
    return { results: [], networkError: true };
  }
}
