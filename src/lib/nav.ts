import {
  Compass,
  Feather,
  Flame,
  LampDesk,
  LibraryBig,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Single source of truth for the app's navigation destinations. */
export const DISCOVER_SEARCH = { q: undefined, categoria: undefined } as const;

export type MemberDestination =
  "/" | "/descobrir" | "/biblioteca" | "/diario" | "/metas" | "/ranking";

export const MEMBER_NAV: {
  label: string;
  to: MemberDestination;
  icon: LucideIcon;
  /** Extra paths that also light this item up. */
  also?: string[];
}[] = [
  { label: "Início", to: "/", icon: LampDesk },
  { label: "Descobrir", to: "/descobrir", icon: Compass, also: ["/livro", "/catalogo"] },
  { label: "Estante", to: "/biblioteca", icon: LibraryBig },
  { label: "Diário", to: "/diario", icon: Feather },
  { label: "Jornada", to: "/metas", icon: Flame, also: ["/desafios"] },
  { label: "Clube", to: "/ranking", icon: Users },
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
}

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

export function rememberLastBook(readerId: string, title?: string, author?: string) {
  try {
    localStorage.setItem(LAST_BOOK_KEY, JSON.stringify({ id: readerId, title, author }));
  } catch {
    // storage unavailable — "Ler" falls back to Descobrir
  }
}
