/**
 * Site-wide visual theme — separate from the in-reader theme (which only
 * affects the reading surface itself and lives in reader-store.ts). This
 * one changes the whole app's chrome: Home, Biblioteca, Perfil, etc.
 *
 * Stored locally per device (like reader settings) rather than synced to
 * the account — it's a display preference, not reading data.
 */

export type SiteTheme = "dark" | "light" | "sepia" | "paper";

const STORAGE_KEY = "bookverse:theme";
const THEMES: SiteTheme[] = ["dark", "light", "sepia", "paper"];

export const THEME_LABEL: Record<SiteTheme, string> = {
  dark: "Escuro",
  light: "Claro",
  sepia: "Sépia",
  paper: "Papel",
};

/** Small representative colors for each theme, used by swatch pickers. */
export const THEME_PREVIEW: Record<SiteTheme, { bg: string; fg: string }> = {
  dark: { bg: "#141210", fg: "#E8DFD3" },
  light: { bg: "#FCFCFB", fg: "#231F1A" },
  sepia: { bg: "#DDCBA9", fg: "#3A2A1D" },
  paper: { bg: "#EEEAE1", fg: "#28241F" },
};

export function getStoredTheme(): SiteTheme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && THEMES.includes(stored as SiteTheme) ? (stored as SiteTheme) : "dark";
}

export function applyTheme(theme: SiteTheme): void {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable — theme just won't persist across reloads
  }
}

export function allThemes(): SiteTheme[] {
  return THEMES;
}
