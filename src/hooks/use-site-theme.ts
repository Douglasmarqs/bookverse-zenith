import { useCallback, useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type SiteTheme } from "@/lib/theme";

// Every mounted consumer (header switcher, ⌘K palette, profile page…) is
// notified when any one of them changes the theme, so their UI never shows
// a stale selection.
const listeners = new Set<(t: SiteTheme) => void>();

/** Reactive access to the site-wide theme, kept in sync across components. */
export function useSiteTheme(): [SiteTheme, (t: SiteTheme) => void] {
  const [theme, setThemeState] = useState<SiteTheme>("light");

  useEffect(() => {
    setThemeState(getStoredTheme());
    listeners.add(setThemeState);
    return () => {
      listeners.delete(setThemeState);
    };
  }, []);

  const setTheme = useCallback((t: SiteTheme) => {
    applyTheme(t);
    listeners.forEach((l) => l(t));
  }, []);

  return [theme, setTheme];
}
