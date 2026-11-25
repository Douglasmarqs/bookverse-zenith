/**
 * Free-books catalogue — browser side.
 *
 * searchCatalog() asks our server (Gutenberg, Standard Ebooks, Internet
 * Archive) and Wikisource directly, in parallel, then ranks everything
 * together. downloadBook() fetches the EPUB, parses it with the same
 * importer as personal files and keeps it on the device (and in the
 * reader's cloud copy when signed in), so it opens offline from then on.
 */
import { useEffect, useState } from "react";

import {
  parseWikisource,
  rankCatalog,
  type CatalogBook,
  type CatalogSource,
} from "./catalog-shared";
import { getFirebase } from "./firebase";
import { saveEpubBook, uploadEpubBookToCloud, deleteEpubBook } from "./epub-store";
import { addToLibrary } from "./library";
import { niceAuthor } from "./catalog-shared";
import { forgetDeviceBook, rememberDeviceBook } from "./device-books";

export type { CatalogBook, CatalogSource };

export const SOURCE_LABEL: Record<CatalogSource, string> = {
  gutenberg: "Project Gutenberg",
  wikisource: "Wikisource",
  standard: "Standard Ebooks",
  archive: "Internet Archive",
};

const cache = new Map<string, Promise<CatalogBook[]>>();

async function searchWikisourceDirect(q: string, signal?: AbortSignal): Promise<CatalogBook[]> {
  try {
    const r = await fetch(
      `https://pt.wikisource.org/w/api.php?action=query&list=search&srnamespace=0&srlimit=14&format=json&origin=*&srsearch=${encodeURIComponent(q)}`,
      {
        signal,
        headers: { "Api-User-Agent": "BookVerse/1.0 (+https://bookverse-zenith.vercel.app)" },
      },
    );
    if (!r.ok) return [];
    return parseWikisource(await r.json());
  } catch {
    return [];
  }
}

async function searchServer(
  q: string,
  sources: string,
  signal?: AbortSignal,
): Promise<CatalogBook[]> {
  try {
    const r = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}&sources=${sources}`, {
      signal,
    });
    if (!r.ok) return [];
    return ((await r.json()) as { results: CatalogBook[] }).results ?? [];
  } catch {
    return [];
  }
}

/**
 * Gutenberg through our server; when Gutendex refuses the server (it does
 * for some cloud hosts) fall back to the app's existing Cloud Function /
 * direct Gutendex search.
 */
async function searchGutenberg(q: string, signal?: AbortSignal): Promise<CatalogBook[]> {
  const viaServer = await searchServer(q, "gutenberg", signal);
  if (viaServer.length || signal?.aborted) return viaServer;
  try {
    const { searchPublicDomainBooks } = await import("./public-domain");
    const r = await searchPublicDomainBooks(q, 16);
    return r.map((b) => ({
      key: `gutenberg:${b.id}`,
      source: "gutenberg" as const,
      id: String(b.id),
      title: b.title.split(/[:;]/)[0]!.trim(),
      author: niceAuthor(
        b.author.split(",").length > 2 ? b.author.split(/,(?=[^,]*,)/)[0]! : b.author,
      ),
      language: b.languages?.[0] ?? null,
      cover: b.cover,
      readerId: `gutenberg-${b.id}`,
    }));
  } catch {
    return [];
  }
}

/** Every free source at once, ranked together (Portuguese first). */
export function searchCatalog(
  q: string,
  opts: { lang?: string | null } = {},
): Promise<CatalogBook[]> {
  const query = q.trim();
  if (query.length < 2) return Promise.resolve([]);
  const key = `${query.toLowerCase()}|${opts.lang ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = Promise.all([
    searchServer(query, "standard,archive"),
    searchGutenberg(query),
    searchWikisourceDirect(query),
  ]).then((parts) => rankCatalog(parts.flat(), query, opts.lang));
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

/**
 * Same search, but reports results as each source answers, so the list
 * fills in progressively instead of waiting for the slowest catalogue.
 */
export function searchCatalogLive(
  q: string,
  onUpdate: (results: CatalogBook[], pending: number) => void,
  opts: { lang?: string | null } = {},
): () => void {
  const query = q.trim();
  const ctrl = new AbortController();
  if (query.length < 2) {
    onUpdate([], 0);
    return () => ctrl.abort();
  }
  const got: CatalogBook[] = [];
  const jobs = [
    searchServer(query, "standard,archive", ctrl.signal),
    searchGutenberg(query, ctrl.signal),
    searchWikisourceDirect(query, ctrl.signal),
  ];
  let pending = jobs.length;
  for (const job of jobs) {
    void job.then((r) => {
      if (ctrl.signal.aborted) return;
      got.push(...r);
      pending -= 1;
      onUpdate(rankCatalog(got, query, opts.lang), pending);
      if (pending === 0) {
        cache.set(
          `${query.toLowerCase()}|${opts.lang ?? ""}`,
          Promise.resolve(rankCatalog(got, query, opts.lang)),
        );
      }
    });
  }
  return () => ctrl.abort();
}

/* ------------------------------ downloads ----------------------------- */

const DOWNLOADED_KEY = "bookverse:catalog-downloads";

function readDownloaded(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DOWNLOADED_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Reader id of a catalogue book already on this device, if any. */
export function downloadedReaderId(key: string): string | null {
  return readDownloaded()[key] ?? null;
}

export type DownloadState =
  | { state: "downloading"; progress: number }
  | { state: "preparing" }
  | { state: "done"; readerId: string }
  | { state: "error"; message: string };

const states = new Map<string, DownloadState>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (key: string, s: DownloadState) => {
  states.set(key, s);
  emit();
};

/** Live state of every download — powers buttons and the downloads list. */
export function useDownloads(): Map<string, DownloadState> {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return states;
}

function downloadUrl(book: CatalogBook): string {
  return `/api/catalog/download?source=${book.source}&id=${encodeURIComponent(book.id)}`;
}

async function fetchWithProgress(url: string, onProgress: (p: number) => void): Promise<Blob> {
  // A connection that stops sending for 20 s is treated as dropped.
  const ctrl = new AbortController();
  let stall = setTimeout(() => ctrl.abort(), 60_000);
  const kick = () => {
    clearTimeout(stall);
    stall = setTimeout(() => ctrl.abort(), 20_000);
  };
  try {
    return await readWithProgress(url, ctrl.signal, onProgress, kick);
  } catch (err) {
    if (ctrl.signal.aborted)
      throw new Error("A fonte demorou demais para responder. Tente de novo.");
    throw err;
  } finally {
    clearTimeout(stall);
  }
}

async function readWithProgress(
  url: string,
  signal: AbortSignal,
  onProgress: (p: number) => void,
  kick: () => void,
): Promise<Blob> {
  const r = await fetch(url, { signal });
  kick();
  if (!r.ok) {
    const msg = await r
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new Error(msg || "Não foi possível baixar este livro agora.");
  }
  const total = Number(r.headers.get("content-length") ?? 0);
  if (!r.body) return r.blob();
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    kick();
    onProgress(total ? Math.min(0.99, got / total) : Math.min(0.9, got / 2_000_000));
  }
  return new Blob(chunks as BlobPart[], { type: "application/epub+zip" });
}

/**
 * Downloads a catalogue book and keeps it on this device (and in the
 * reader's private cloud copy when signed in). Returns its reader id.
 */
export async function downloadBook(book: CatalogBook): Promise<string> {
  const existing = downloadedReaderId(book.key);
  if (existing) {
    setState(book.key, { state: "done", readerId: existing });
    return existing;
  }
  setState(book.key, { state: "downloading", progress: 0 });
  try {
    const onProgress = (progress: number) => setState(book.key, { state: "downloading", progress });
    let blob: Blob;
    try {
      blob = await fetchWithProgress(downloadUrl(book), onProgress);
    } catch (first) {
      // Sources like Wikisource build the EPUB on the first request; the
      // second try usually comes straight from their cache.
      if (!(first instanceof Error) || !/demorou|não entregou/i.test(first.message)) throw first;
      blob = await fetchWithProgress(downloadUrl(book), onProgress);
    }
    setState(book.key, { state: "preparing" });
    const file = new File([blob], `${book.title}.epub`, { type: "application/epub+zip" });
    const { parseEpubFile } = await import("./epub-parser");
    const parsed = await parseEpubFile(file);
    // Keep the catalogue's cleaner metadata when the file's is poor.
    if (!parsed.title || /^untitled|sem t[ií]tulo/i.test(parsed.title)) parsed.title = book.title;
    if (!parsed.author || /desconhecid|unknown/i.test(parsed.author)) parsed.author = book.author;
    if (!parsed.cover && book.cover) parsed.cover = book.cover;
    // Drop the sources' technical pages (export notices, credits, licences)
    // so the book opens straight on the text.
    const words = (c: (typeof parsed.chapters)[number]) =>
      c.paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
    const junk = (c: (typeof parsed.chapters)[number]) =>
      /cr[ée]ditos|sobre est[ea]|about this (e?book)|licen[çc]a|license/i.test(c.title) ||
      /^\s*([íi]ndice|sum[áa]rio|contents|table of contents)\s*$/i.test(c.title) ||
      words(c) < 8 ||
      (words(c) < 120 &&
        /wikisource|exportado|project gutenberg|standard ebooks/i.test(c.paragraphs.join(" ")));
    const kept = parsed.chapters.filter((c) => !junk(c));
    if (kept.length) parsed.chapters = kept;
    await saveEpubBook(parsed);

    // Readable right away; the private cloud copy and the shelf entry
    // follow in the background.
    const user = getFirebase()?.auth.currentUser;
    if (user && !user.isAnonymous) {
      void addToLibrary(
        user.uid,
        {
          title: parsed.title,
          author: parsed.author,
          cover: parsed.cover ?? null,
          readerId: parsed.id,
        },
        "quero-ler",
      ).catch(() => {});
      void uploadEpubBookToCloud(user.uid, parsed, file).catch(() => {});
    }
    rememberDeviceBook({
      id: parsed.id,
      title: parsed.title,
      author: parsed.author,
      kind: "epub",
      bytes: blob.size,
      addedAt: Date.now(),
      origin: "catalogo",
    });
    const map = readDownloaded();
    map[book.key] = parsed.id;
    try {
      localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(map));
    } catch {
      // storage full — the book is still saved in IndexedDB
    }
    setState(book.key, { state: "done", readerId: parsed.id });
    return parsed.id;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Não foi possível baixar este livro agora.";
    setState(book.key, { state: "error", message });
    throw err;
  }
}

/** Removes a downloaded catalogue book from this device. */
export async function removeDownload(key: string): Promise<void> {
  const map = readDownloaded();
  const id = map[key];
  if (id) {
    await deleteEpubBook(id).catch(() => {});
    forgetDeviceBook(id);
  }
  delete map[key];
  try {
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  states.delete(key);
  emit();
}

/** Forgets the catalogue entry that points at a removed device book. */
export function forgetDownloadedReaderId(readerId: string): void {
  const map = readDownloaded();
  let changed = false;
  for (const [key, id] of Object.entries(map)) {
    if (id === readerId) {
      delete map[key];
      states.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  emit();
}
