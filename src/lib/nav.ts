import {
  ChartNoAxesColumn,
  CircleUserRound,
  Compass,
  House,
  LibraryBig,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

/** Single source of truth for the app's navigation destinations. */
export const DISCOVER_SEARCH = { q: undefined, categoria: undefined } as const;

export type MemberDestination = "/" | "/descobrir" | "/biblioteca" | "/perfil";

/** The four tabs: Início · Explorar · Biblioteca · Você. */
export const MEMBER_NAV: {
  label: string;
  to: MemberDestination;
  icon: LucideIcon;
  /** Extra paths that also light this item up. */
  also?: string[];
}[] = [
  { label: "Início", to: "/", icon: House },
  { label: "Explorar", to: "/descobrir", icon: Compass, also: ["/livro", "/catalogo"] },
  { label: "Biblioteca", to: "/biblioteca", icon: LibraryBig },
  {
    label: "Você",
    to: "/perfil",
    icon: CircleUserRound,
    also: ["/metas", "/desafios", "/ranking", "/diario"],
  },
];

/** Desktop sidebar: same places, with "Você" split into its two halves. */
export const DESKTOP_NAV: {
  label: string;
  to: "/" | "/descobrir" | "/biblioteca" | "/metas" | "/desafios";
  icon: LucideIcon;
  also?: string[];
}[] = [
  { label: "Início", to: "/", icon: House },
  { label: "Explorar", to: "/descobrir", icon: Compass, also: ["/livro", "/catalogo"] },
  { label: "Biblioteca", to: "/biblioteca", icon: LibraryBig },
  { label: "Progresso", to: "/metas", icon: ChartNoAxesColumn, also: ["/diario", "/perfil"] },
  { label: "Desafios", to: "/desafios", icon: Trophy, also: ["/ranking"] },
];

export function isNavActive(
  pathname: string,
  item: { to: string; also?: readonly string[] },
): boolean {
  if (item.to === "/") return pathname === "/";
  return [item.to, ...(item.also ?? [])].some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export const VISITOR_NAV = [
  { label: "O leitor", hash: "leitor" },
  { label: "Lumi", hash: "lumi" },
  { label: "Ritual", hash: "ritual" },
  { label: "Perguntas", hash: "faq" },
] as const;

/** Last book opened in the reader, so "Ler" can jump straight back in. */
export const LAST_BOOK_KEY = "bookverse:last-book";

export interface LastBook {
  id: string;
  title?: string;
  author?: string;
  /** 0–1 through the whole book. */
  progress?: number;
  /** e.g. "Cap. 32". */
  chapter?: string;
  /** Minutes left in the current chapter, when known. */
  chapterMinutesLeft?: number;
  /** Minutes left in the whole book, when known. */
  bookMinutesLeft?: number;
  cover?: string;
  updatedAt?: number;
}

const LAST_BOOK_EVENT = "bookverse:last-book";

export function getLastBookInfo(): LastBook | null {
  try {
    const raw = localStorage.getItem(LAST_BOOK_KEY);
    if (!raw) return null;
    // Older versions stored the bare reader id.
    if (!raw.startsWith("{")) return { id: raw };
    const parsed = JSON.parse(raw) as LastBook;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function getLastBook(): string | null {
  return getLastBookInfo()?.id ?? null;
}

/** Records the book being read (merging with what is already known about it). */
export function rememberLastBook(
  readerId: string,
  title?: string,
  author?: string,
  extra: Partial<Omit<LastBook, "id" | "title" | "author">> = {},
) {
  try {
    const prev = getLastBookInfo();
    const base = prev?.id === readerId ? prev : { id: readerId };
    const next: LastBook = {
      ...base,
      ...(title ? { title } : {}),
      ...(author ? { author } : {}),
      ...extra,
      updatedAt: Date.now(),
    };
    localStorage.setItem(LAST_BOOK_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(LAST_BOOK_EVENT));
    markStarted();
  } catch {
    // storage unavailable — "Lendo agora" just stays hidden
  }
}

export function forgetLastBook() {
  try {
    localStorage.removeItem(LAST_BOOK_KEY);
    window.dispatchEvent(new Event(LAST_BOOK_EVENT));
  } catch {
    // ignore
  }
}

/** Live view of the book being read — powers the "Lendo agora" bar. */
export function useLastBook(): LastBook | null {
  const [book, setBook] = useState<LastBook | null>(null);
  useEffect(() => {
    const sync = () => setBook(getLastBookInfo());
    sync();
    window.addEventListener(LAST_BOOK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LAST_BOOK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return book;
}

/* ------------------------------ guests ------------------------------ */

/** Reader id used for progress and ritual when there is no account. */
export const OFFLINE_UID = "offline-reader";

const STARTED_KEY = "bookverse:started";
const STARTED_EVENT = "bookverse:started";

/** Someone who already uses the app (read, downloaded or set it up) sees
 * Início on "/" instead of the marketing landing, even without an account. */
export function markStarted() {
  try {
    if (localStorage.getItem(STARTED_KEY) === "1") return;
    localStorage.setItem(STARTED_KEY, "1");
    window.dispatchEvent(new Event(STARTED_EVENT));
  } catch {
    // ignore
  }
}

function readStarted(): boolean {
  try {
    return localStorage.getItem(STARTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useStarted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(STARTED_EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(STARTED_EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    readStarted,
    () => false,
  );
}
