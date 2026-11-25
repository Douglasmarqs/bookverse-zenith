import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type SiteTheme,
} from "@/lib/theme";

// Every mounted consumer (switcher, ⌘K, profile…) hears about changes made
// by any other one, so no control ever shows a stale selection.
const listeners = new Set<(t: SiteTheme) => void>();

/** Reactive site ambience: [preference, setPreference, resolvedAmbience]. */
export function useSiteTheme(): [SiteTheme, (t: SiteTheme) => void, ResolvedTheme] {
  const [theme, setThemeState] = useState<SiteTheme>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("claro");

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    setResolved(resolveTheme(stored));
    const listener = (t: SiteTheme) => {
      setThemeState(t);
      setResolved(resolveTheme(t));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // "Automático" follows the OS live, e.g. when the phone flips to dark at night.
  useEffect(() => {
    if (theme !== "auto" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("auto", false));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: SiteTheme) => {
    applyTheme(t);
    listeners.forEach((l) => l(t));
  }, []);

  return [theme, setTheme, resolved];
}
