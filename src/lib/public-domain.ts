/**
 * Client for public-domain books with real, full text — proxied through the
 * `searchPublicDomainBooks` / `getPublicDomainBook` Cloud Functions (see
 * /functions/src/public-domain.ts) so we never depend on Gutendex/Gutenberg
 * CORS support from the browser.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase } from "./firebase";
import type { Book } from "./sample-book";

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

export async function searchPublicDomainBooks(
  query: string,
  maxResults = 12,
): Promise<PublicDomainSummary[]> {
  const fb = getFirebase();
  if (!fb || !query.trim()) return [];
  try {
    const fn = httpsCallable<
      { query: string; maxResults?: number },
      { results: PublicDomainSummary[] }
    >(getFunctions(fb.app), "searchPublicDomainBooks");
    const res = await fn({ query, maxResults });
    return res.data.results ?? [];
  } catch (err) {
    console.warn("[public-domain] search failed", err);
    return [];
  }
}

export async function getPublicDomainBook(gutenbergId: number): Promise<Book> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase não inicializado.");
  const fn = httpsCallable<{ gutenbergId: number }, Book>(
    getFunctions(fb.app),
    "getPublicDomainBook",
  );
  const res = await fn({ gutenbergId });
  return res.data;
}
