import { useCallback, useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type SiteTheme } from "@/lib/theme";

/** Reactive access to the site-wide theme. Safe to use in multiple
 * components at once — each mounts with the currently-applied theme and
 * stays in sync if another component changes it. */
export function useSiteTheme(): [SiteTheme, (t: SiteTheme) => void] {
  const [theme, setThemeState] = useState<SiteTheme>("dark");

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  const setTheme = useCallback((t: SiteTheme) => {
    setThemeState(t);
    applyTheme(t);
  }, []);

  return [theme, setTheme];
}
