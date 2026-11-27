import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Safety net for "blocks wider than the screen": after each navigation and
 * whenever the viewport changes (rotation, split view, font size), find
 * elements in the page that stick out past the screen edge — outside of the
 * deliberate horizontal scrollers and clipped decorations — and let them
 * shrink to fit (see [data-fit] in styles.css). Cheap: runs at most a few
 * times per screen, idle-scheduled.
 */
export function FitGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname.startsWith("/reader/")) return; // the reader paginates itself
    let raf = 0;
    const timers: number[] = [];

    const clippedOrScrolls = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox !== "visible") return true;
      }
      return false;
    };

    const scan = () => {
      const main = document.querySelector("main");
      if (!main) return;
      const vw = document.documentElement.clientWidth;
      // Fast path: nothing sticks out of the page (the usual case) — skip
      // measuring every element, which cost a visible hitch after each
      // navigation on phones.
      if (document.documentElement.scrollWidth <= vw + 1) return;
      const fixed: string[] = [];
      for (const el of main.querySelectorAll<HTMLElement>("*")) {
        if (el.dataset.fit === "1") continue;
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= vw + 1) continue;
        if (r.left >= vw) continue; // off-screen on purpose (carousels, drawers)
        if (clippedOrScrolls(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" || cs.position === "absolute") continue;
        el.dataset.fit = "1";
        if (import.meta.env.DEV) fixed.push(el.tagName.toLowerCase() + "." + el.className);
      }
      if (import.meta.env.DEV && fixed.length) console.info("[fit-guard] ajustado:", fixed);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const idle = (
          window as {
            requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
          }
        ).requestIdleCallback;
        if (idle) idle(scan, { timeout: 2000 });
        else scan();
      });
    };

    // After the page settles (data, images, fonts).
    // Not during the page's entrance animation.
    for (const ms of [700, 2500]) timers.push(window.setTimeout(schedule, ms));
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [pathname]);

  return null;
}
