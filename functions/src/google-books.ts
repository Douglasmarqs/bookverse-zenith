/**
 * Google Books proxy — resolves real cover art / metadata and runs the
 * catalog search server-side instead of directly from the browser.
 *
 * Why this exists: calling `www.googleapis.com` straight from the client
 * works most of the time, but is unreliable in some environments (ad/
 * privacy blockers that filter Google API subdomains, corporate/school
 * network filters, sandboxed preview iframes). Cloud Functions egress does
 * not have that problem, so proxying here — the same pattern already used
 * for Gutenberg in `public-domain.ts` — makes the catalog reliable
 * regardless of the visitor's browser/network setup. The client
 * (`src/lib/google-books.ts`) still keeps a direct-fetch fallback for
 * resilience if Cloud Functions themselves are unreachable.
 */
import { onCall } from "firebase-functions/v2/https";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";

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

// Mirrors src/lib/google-books.ts CATEGORY_QUERY — the `subject:` operator
// only matches Google's internal (mostly English) taxonomy, so plain
// keywords work far better for our Portuguese category chips.
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

function toMeta(info: GoogleVolumeInfo, fallbackTitle: string, fallbackAuthor?: string): BookMeta {
  return {
    title: info.title ?? fallbackTitle,
    author: info.authors?.join(", ") ?? fallbackAuthor ?? "Autor desconhecido",
    cover: info.imageLinks?.thumbnail ? upgradeCoverUrl(info.imageLinks.thumbnail) : null,
    description: info.description,
    previewLink: info.previewLink,
    averageRating: info.averageRating,
    ratingsCount: info.ratingsCount,
    categories: info.categories,
  };
}

/** Single-title lookup — used to resolve real cover art for a title/author pair. */
export const getGoogleBookMeta = onCall<{ title?: string; author?: string }>(
  { cors: true, maxInstances: 20, timeoutSeconds: 15 },
  async (request) => {
    const title = (request.data?.title ?? "").trim();
    const author = (request.data?.author ?? "").trim();
    if (!title) return { meta: null as BookMeta | null };

    try {
      const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
      const url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=1&printType=books`;
      const res = await fetchWithTimeout(url, 9000);
      if (!res.ok) return { meta: null as BookMeta | null };
      const data = (await res.json()) as { items?: { volumeInfo?: GoogleVolumeInfo }[] };
      const info = data.items?.[0]?.volumeInfo;
      return { meta: info ? toMeta(info, title, author) : null };
    } catch (err) {
      console.warn("[getGoogleBookMeta] failed", err);
      return { meta: null as BookMeta | null };
    }
  },
);

/** Full-text catalog search — powers "Descobrir" and the general catalog. */
export const searchGoogleBooks = onCall<{ query?: string; category?: string; maxResults?: number }>(
  { cors: true, maxInstances: 20, timeoutSeconds: 15 },
  async (request) => {
    const trimmed = (request.data?.query ?? "").trim();
    const categoryKey = request.data?.category;
    const categoryTerm = categoryKey ? (CATEGORY_QUERY[categoryKey] ?? categoryKey) : "";

    const parts: string[] = [];
    if (trimmed) parts.push(trimmed);
    if (categoryTerm && categoryTerm !== trimmed) parts.push(categoryTerm);
    const q = parts.join(" ").trim();
    if (!q) return { results: [] as BookMeta[] };

    const maxResults = Math.min(request.data?.maxResults ?? 24, 40);

    try {
      const url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=${maxResults}&printType=books`;
      const res = await fetchWithTimeout(url, 9000);
      if (!res.ok) throw new Error(`Google Books ${res.status}`);
      const data = (await res.json()) as { items?: { volumeInfo?: GoogleVolumeInfo }[] };
      const results = (data.items ?? [])
        .filter((it) => it.volumeInfo?.title)
        .map((it) => toMeta(it.volumeInfo as GoogleVolumeInfo, "", ""));
      return { results };
    } catch (err) {
      console.warn("[searchGoogleBooks] failed", err);
      return { results: [] as BookMeta[], error: true };
    }
  },
);
