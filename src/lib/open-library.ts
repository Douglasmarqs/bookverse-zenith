/**
 * Open Library client — free, keyless catalog API (openlibrary.org).
 *
 * Used to power the "Descobrir / Catálogo" experience with real bestsellers,
 * trending titles and subject browsing. Reading full text stays with Project
 * Gutenberg (see `public-domain.ts`) — Open Library is for discovery, cover
 * art and metadata.
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

// Session cache — Open Library is fast but we don't want to hit it every
// mount while the user browses.
const memCache = new Map<string, OpenLibraryBook[]>();

async function cachedFetch(key: string, url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open Library ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[open-library] ${key} failed`, err);
    return null;
  }
}

/** Books in a given subject (fiction, fantasy, mystery, etc.). */
export async function booksBySubject(
  subject: string,
  limit = 12,
): Promise<OpenLibraryBook[]> {
  const key = `subject:${subject}:${limit}`;
  if (memCache.has(key)) return memCache.get(key)!;

  const data = await cachedFetch(
    key,
    `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}`,
  );
  if (!data) return [];

  const works = (data.works ?? []) as any[];
  const results: OpenLibraryBook[] = works
    .filter((w) => w.title && w.key)
    .map((w) => ({
      title: w.title as string,
      author: (w.authors?.map((a: any) => a.name).join(", ") as string) ?? "Autor desconhecido",
      cover: w.cover_id ? COVER(w.cover_id) : null,
      workKey: w.key as string,
      firstPublishYear: w.first_publish_year,
    }));
  memCache.set(key, results);
  return results;
}

/** Trending titles ("hourly" | "daily" | "weekly" | "monthly" | "yearly"). */
export async function trendingBooks(
  window: "daily" | "weekly" | "monthly" | "yearly" = "weekly",
  limit = 12,
): Promise<OpenLibraryBook[]> {
  const key = `trending:${window}:${limit}`;
  if (memCache.has(key)) return memCache.get(key)!;

  const data = await cachedFetch(
    key,
    `https://openlibrary.org/trending/${window}.json?limit=${limit}`,
  );
  if (!data) return [];

  const works = (data.works ?? []) as any[];
  const results: OpenLibraryBook[] = works
    .filter((w) => w.title && w.key)
    .map((w) => ({
      title: w.title as string,
      author: (w.author_name?.join(", ") as string) ?? "Autor desconhecido",
      cover: w.cover_i ? COVER(w.cover_i) : null,
      workKey: w.key as string,
      firstPublishYear: w.first_publish_year,
    }));
  memCache.set(key, results);
  return results;
}

/** Free-text search — used by the "Descobrir" search field. */
export async function searchOpenLibrary(
  query: string,
  limit = 24,
): Promise<OpenLibraryBook[]> {
  const q = query.trim();
  if (!q) return [];
  const key = `search:${q}:${limit}`;
  if (memCache.has(key)) return memCache.get(key)!;

  const data = await cachedFetch(
    key,
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year`,
  );
  if (!data) return [];

  const docs = (data.docs ?? []) as any[];
  const results: OpenLibraryBook[] = docs
    .filter((d) => d.title && d.key)
    .map((d) => ({
      title: d.title as string,
      author: (d.author_name?.join(", ") as string) ?? "Autor desconhecido",
      cover: d.cover_i ? COVER(d.cover_i) : null,
      workKey: d.key as string,
      firstPublishYear: d.first_publish_year,
    }));
  memCache.set(key, results);
  return results;
}
