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

export function getLastBook(): string | null {
  try {
    return localStorage.getItem(LAST_BOOK_KEY);
  } catch {
    return null;
  }
}

export function rememberLastBook(readerId: string) {
  try {
    localStorage.setItem(LAST_BOOK_KEY, readerId);
  } catch {
    // storage unavailable — "Ler" falls back to Descobrir
  }
}
