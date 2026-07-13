/**
 * Open Library client — free, keyless catalog API (openlibrary.org).
 *
 * Powers the "Descobrir / Catálogo" experience. Results are cached in two
 * layers to avoid hitting the API on every mount:
 *   1. In-memory Map — instant reuse within a session.
 *   2. localStorage — survives reloads. Entries have a TTL (invalidação
 *      automática) and a schema version so a code change forces a refresh.
 *
 * Use `invalidateOpenLibraryCache()` to force a full refresh (e.g. from a
 * "Atualizar catálogo" button).
 *
 * Docs: https://openlibrary.org/developers/api
 */
import type { BookMeta } from "./google-books";

export interface OpenLibraryBook extends BookMeta {
  /** Open Library work key, e.g. "/works/OL45804W". */
  workKey: string;
  firstPublishYear?: number;
}

const COVER = (id: number, size: "S" | "M" | "L" = "L") =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

// ---------------------------------------------------------------------------
// Cache layer
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "bookverse:openlib:";
const CACHE_VERSION = 1;

/** Default TTLs. Trending is short (data changes daily); subject/search are
 * long — the underlying catalog barely moves. */
const TTL = {
  trending: 60 * 60 * 1000, // 1h
  subject: 24 * 60 * 60 * 1000, // 24h
  search: 6 * 60 * 60 * 1000, // 6h
} as const;

interface CacheEntry<T> {
  v: number;
  t: number; // stored-at timestamp (ms)
  ttl: number;
  data: T;
}

const memCache = new Map<string, OpenLibraryBook[]>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Timestamp (ms) until which the in-memory / persisted entry is considered
 * fresh. If `now > freshUntil`, the entry is served stale-while-revalidate:
 * returned immediately, then refreshed in the background. */
const freshUntil = new Map<string, number>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads the raw persistent entry — including expired ones, so callers can
 * implement stale-while-revalidate. Returns undefined only when the entry is
 * missing, malformed, or from an older schema version. */
function readPersistentEntry<T>(key: string): CacheEntry<T> | undefined {
  const s = storage();
  if (!s) return undefined;
  try {
    const raw = s.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.v !== CACHE_VERSION) {
      s.removeItem(CACHE_PREFIX + key);
      return undefined;
    }
    return entry;
  } catch {
    return undefined;
  }
}

function writePersistent<T>(key: string, data: T, ttl: number) {
  const s = storage();
  if (!s) return;
  try {
    const entry: CacheEntry<T> = { v: CACHE_VERSION, t: Date.now(), ttl, data };
    s.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded — best-effort trim of our own keys and retry once.
    try {
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) s.removeItem(k);
      }
      const entry: CacheEntry<T> = { v: CACHE_VERSION, t: Date.now(), ttl, data };
      s.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // give up silently
    }
  }
}

/** In-flight request dedupe: if two shelves ask for the same key at the same
 * time, share the same promise instead of firing two fetches. */
const inflight = new Map<string, Promise<OpenLibraryBook[]>>();

/** Force a full refresh — clears memory + persistent caches. */
export function invalidateOpenLibraryCache(): void {
  memCache.clear();
  freshUntil.clear();
  inflight.clear();
  const s = storage();
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) s.removeItem(k);
    }
  } catch {
    // ignore
  }
}

async function cachedFetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open Library ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[open-library] fetch failed`, err);
    return null;
  }
}

export interface CacheOpts {
  /** Called when a background stale-while-revalidate refresh produces new
   * data. Consumers can use this to update their UI after the initial stale
   * render. Not invoked when data was already fresh. */
  onUpdate?: (results: OpenLibraryBook[]) => void;
}

function scheduleRevalidate(
  key: string,
  ttl: number,
  loader: () => Promise<OpenLibraryBook[]>,
  onUpdate?: (results: OpenLibraryBook[]) => void,
) {
  if (inflight.has(key)) {
    if (onUpdate) inflight.get(key)!.then((r) => r.length > 0 && onUpdate(r));
    return;
  }
  const p = loader()
    .then((results) => {
      if (results.length > 0) {
        memCache.set(key, results);
        freshUntil.set(key, Date.now() + ttl);
        writePersistent(key, results, ttl);
        onUpdate?.(results);
      }
      return results;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
}

/** Shared cache runner with stale-while-revalidate semantics:
 *   1. Memory hit + still fresh → return immediately, no network.
 *   2. Memory hit but stale → return stale, refresh in background.
 *   3. Persistent hit (fresh or stale) → hydrate memory, return; if stale,
 *      also refresh in background.
 *   4. No cache → fetch, dedupe concurrent callers, cache result.
 */
async function withCache(
  key: string,
  ttl: number,
  loader: () => Promise<OpenLibraryBook[]>,
  opts: CacheOpts = {},
): Promise<OpenLibraryBook[]> {
  const now = Date.now();

  const mem = memCache.get(key);
  if (mem) {
    const fresh = (freshUntil.get(key) ?? 0) > now;
    if (!fresh) scheduleRevalidate(key, ttl, loader, opts.onUpdate);
    return mem;
  }

  const persisted = readPersistentEntry<OpenLibraryBook[]>(key);
  if (persisted) {
    memCache.set(key, persisted.data);
    freshUntil.set(key, persisted.t + persisted.ttl);
    const fresh = persisted.t + persisted.ttl > now;
    if (!fresh) scheduleRevalidate(key, ttl, loader, opts.onUpdate);
    return persisted.data;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = loader()
    .then((results) => {
      memCache.set(key, results);
      // Only cache non-empty results — an empty array usually means the API
      // failed transiently, and we don't want to pin that for hours.
      if (results.length > 0) {
        freshUntil.set(key, Date.now() + ttl);
        writePersistent(key, results, ttl);
      }
      return results;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Books in a given subject (fiction, fantasy, mystery, etc.). */
export async function booksBySubject(
  subject: string,
  limit = 12,
): Promise<OpenLibraryBook[]> {
  return withCache(`subject:${subject}:${limit}`, TTL.subject, async () => {
    const data = await cachedFetchJson(
      `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}`,
    );
    if (!data) return [];
    const works = (data.works ?? []) as any[];
    return works
      .filter((w) => w.title && w.key)
      .map((w) => ({
        title: w.title as string,
        author:
          (w.authors?.map((a: any) => a.name).join(", ") as string) ?? "Autor desconhecido",
        cover: w.cover_id ? COVER(w.cover_id) : null,
        workKey: w.key as string,
        firstPublishYear: w.first_publish_year,
      }));
  });
}

/** Trending titles ("hourly" | "daily" | "weekly" | "monthly" | "yearly"). */
export async function trendingBooks(
  window: "daily" | "weekly" | "monthly" | "yearly" = "weekly",
  limit = 12,
): Promise<OpenLibraryBook[]> {
  return withCache(`trending:${window}:${limit}`, TTL.trending, async () => {
    const data = await cachedFetchJson(
      `https://openlibrary.org/trending/${window}.json?limit=${limit}`,
    );
    if (!data) return [];
    const works = (data.works ?? []) as any[];
    return works
      .filter((w) => w.title && w.key)
      .map((w) => ({
        title: w.title as string,
        author: (w.author_name?.join(", ") as string) ?? "Autor desconhecido",
        cover: w.cover_i ? COVER(w.cover_i) : null,
        workKey: w.key as string,
        firstPublishYear: w.first_publish_year,
      }));
  });
}

/** Free-text search — used by the "Descobrir" search field. */
export async function searchOpenLibrary(
  query: string,
  limit = 24,
): Promise<OpenLibraryBook[]> {
  const q = query.trim();
  if (!q) return [];
  return withCache(`search:${q.toLowerCase()}:${limit}`, TTL.search, async () => {
    const data = await cachedFetchJson(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year`,
    );
    if (!data) return [];
    const docs = (data.docs ?? []) as any[];
    return docs
      .filter((d) => d.title && d.key)
      .map((d) => ({
        title: d.title as string,
        author: (d.author_name?.join(", ") as string) ?? "Autor desconhecido",
        cover: d.cover_i ? COVER(d.cover_i) : null,
        workKey: d.key as string,
        firstPublishYear: d.first_publish_year,
      }));
  });
}
