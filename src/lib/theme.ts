/**
 * App appearance — the whole app's look (Início, Biblioteca, Você…). The
 * reading surface has its own, independent themes in reader-store.ts.
 *
 * The preference is stored per device. "auto" follows the operating system
 * and switches live.
 */

export type ResolvedTheme = "claro" | "escuro";
export type SiteTheme = "auto" | ResolvedTheme;

const STORAGE_KEY = "bookverse:theme";
const THEMES: SiteTheme[] = ["auto", "claro", "escuro"];

/** Preferences saved by earlier versions of the app (the old ambiences). */
const LEGACY: Record<string, SiteTheme> = {
  dark: "escuro",
  noturna: "escuro",
  "meia-noite": "escuro",
  bordo: "escuro",
  contraste: "escuro",
  light: "claro",
  paper: "claro",
  papel: "claro",
  sepia: "claro",
};

export const THEME_LABEL: Record<SiteTheme, string> = {
  auto: "Automático",
  claro: "Claro",
  escuro: "Escuro",
};

export const THEME_DESCRIPTION: Record<SiteTheme, string> = {
  auto: "Segue o claro ou escuro do seu aparelho",
  claro: "Branco e limpo, ótimo de dia",
  escuro: "Confortável à noite",
};

/** Representative colours for swatches: background, surface, text, accent. */
export const THEME_PREVIEW: Record<
  ResolvedTheme,
  { bg: string; surface: string; fg: string; accent: string }
> = {
  claro: { bg: "#f4f3ef", surface: "#ffffff", fg: "#131313", accent: "#ff4d1a" },
  escuro: { bg: "#0c0c0e", surface: "#18181b", fg: "#f3f2ee", accent: "#ff6436" },
};

export const THEME_COLOR: Record<ResolvedTheme, string> = {
  claro: "#f4f3ef",
  escuro: "#0c0c0e",
};

function normalise(value: string | null): SiteTheme {
  if (!value) return "auto";
  if ((THEMES as string[]).includes(value)) return value as SiteTheme;
  return LEGACY[value] ?? "auto";
}

export function getStoredTheme(): SiteTheme {
  if (typeof window === "undefined") return "auto";
  try {
    return normalise(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "auto";
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: SiteTheme): ResolvedTheme {
  if (theme !== "auto") return theme;
  return systemPrefersDark() ? "escuro" : "claro";
}

export function applyTheme(theme: SiteTheme, persist = true): ResolvedTheme {
  const resolved = resolveTheme(theme);
  if (typeof document === "undefined") return resolved;
  const root = document.documentElement;
  const swap = () => {
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-pref", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOR[resolved]);
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (
    persist &&
    doc.startViewTransition &&
    !reduce &&
    root.getAttribute("data-theme") !== resolved
  ) {
    doc.startViewTransition(swap);
  } else {
    swap();
  }
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage unavailable — the choice just won't persist across reloads
    }
  }
  return resolved;
}

export function allThemes(): SiteTheme[] {
  return THEMES;
}

/**
 * Inline, render-blocking script for <head>: applies the stored appearance
 * before first paint (no flash), migrating old values on the way.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var L=${JSON.stringify(LEGACY)};var v=localStorage.getItem('${STORAGE_KEY}')||'auto';if(L[v])v=L[v];if(['auto','claro','escuro'].indexOf(v)<0)v='auto';var r=v==='auto'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'escuro':'claro'):v;var d=document.documentElement;d.setAttribute('data-theme',r);d.setAttribute('data-theme-pref',v);}catch(e){}})();`;
