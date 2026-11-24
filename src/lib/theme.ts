/**
 * Site-wide ambiences — the whole app's look (Home, Estante, Perfil…). The
 * reading surface has its own, independent theme in reader-store.ts.
 *
 * The preference is stored per device. "auto" follows the operating system:
 * Noturna when it is dark, Papel when it is light, switching live.
 */

export type ResolvedTheme = "noturna" | "papel" | "sepia" | "meia-noite" | "bordo" | "contraste";
export type SiteTheme = "auto" | ResolvedTheme;

const STORAGE_KEY = "bookverse:theme";
const THEMES: SiteTheme[] = [
  "auto",
  "noturna",
  "papel",
  "sepia",
  "meia-noite",
  "bordo",
  "contraste",
];

/** Preferences saved by earlier versions of the app. */
const LEGACY: Record<string, SiteTheme> = {
  dark: "noturna",
  light: "papel",
  paper: "papel",
  sepia: "sepia",
};

export const THEME_LABEL: Record<SiteTheme, string> = {
  auto: "Automático",
  noturna: "Noturna",
  papel: "Papel",
  sepia: "Sépia",
  "meia-noite": "Meia-noite",
  bordo: "Bordô",
  contraste: "Alto contraste",
};

export const THEME_DESCRIPTION: Record<SiteTheme, string> = {
  auto: "Segue o claro ou escuro do seu aparelho",
  noturna: "Verde-noite e latão, para ler à luz do abajur",
  papel: "Papel claro e tinta, confortável de dia",
  sepia: "Tons quentes de livro antigo",
  "meia-noite": "Azul profundo com prata",
  bordo: "Vinho escuro com ouro rosé",
  contraste: "Preto, branco e amarelo para máxima legibilidade",
};

/** Representative colours for swatches: background, surface, text, accent. */
export const THEME_PREVIEW: Record<
  ResolvedTheme,
  { bg: string; surface: string; fg: string; accent: string }
> = {
  noturna: { bg: "#0b0f0d", surface: "#19221d", fg: "#efe6d2", accent: "#d9a54e" },
  papel: { bg: "#f5efe3", surface: "#fbf8f1", fg: "#1f231f", accent: "#94641b" },
  sepia: { bg: "#eadcbf", surface: "#f2e7cf", fg: "#3a2a1b", accent: "#8a4b17" },
  "meia-noite": { bg: "#0a0f1c", surface: "#182137", fg: "#e6ecf8", accent: "#8fb4ff" },
  bordo: { bg: "#150a0d", surface: "#2a161c", fg: "#f4e4df", accent: "#e7a17a" },
  contraste: { bg: "#000000", surface: "#1a1a1a", fg: "#ffffff", accent: "#ffd60a" },
};

export const THEME_COLOR: Record<ResolvedTheme, string> = {
  noturna: "#0b0f0d",
  papel: "#f5efe3",
  sepia: "#eadcbf",
  "meia-noite": "#0a0f1c",
  bordo: "#150a0d",
  contraste: "#000000",
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
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: SiteTheme): ResolvedTheme {
  if (theme !== "auto") return theme;
  return systemPrefersDark() ? "noturna" : "papel";
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
  // A soft cross-fade between ambiences where the browser supports it.
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
      // storage unavailable — the ambience just won't persist across reloads
    }
  }
  return resolved;
}

export function allThemes(): SiteTheme[] {
  return THEMES;
}

/**
 * Inline, render-blocking script for <head>: applies the stored ambience
 * before first paint (no flash), migrating old values on the way.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var L={dark:'noturna',light:'papel',paper:'papel',sepia:'sepia'};var v=localStorage.getItem('${STORAGE_KEY}')||'auto';if(L[v])v=L[v];var ok=['auto','noturna','papel','sepia','meia-noite','bordo','contraste'];if(ok.indexOf(v)<0)v='auto';var r=v==='auto'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'papel':'noturna'):v;var d=document.documentElement;d.setAttribute('data-theme',r);d.setAttribute('data-theme-pref',v);}catch(e){}})();`;
