import { useEffect } from "react";

/**
 * Leans books with scroll speed: writes a CSS variable (degrees, springing
 * back to 0) on `target` while `source` scrolls. Window scroll → `--sway` on
 * <html>; a rail's horizontal scroll → `--swayx` on the rail. No React state,
 * one rAF loop only while moving.
 */
export function useSway(
  source: () => HTMLElement | Window | null,
  target: () => HTMLElement | null,
  axis: "x" | "y",
  deps: unknown[] = [],
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const src = source();
    const tgt = target();
    if (!src || !tgt) return;
    const prop = axis === "y" ? "--sway" : "--swayx";
    const pos = () =>
      src instanceof Window
        ? axis === "y"
          ? window.scrollY
          : window.scrollX
        : axis === "y"
          ? src.scrollTop
          : src.scrollLeft;

    // Page-wide sway: writing the variable on <html> would make the
    // browser restyle the whole document on every scroll frame. Instead it
    // goes only on the books currently on screen (tracked by an
    // IntersectionObserver), whose subtrees are tiny.
    const pageWide = tgt === document.documentElement;
    const visible = new Set<HTMLElement>();
    const observed = new WeakSet<Element>();
    const io = pageWide
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) visible.add(el);
            else {
              visible.delete(el);
              el.style.removeProperty(prop);
              el.removeAttribute("data-swaying");
            }
          }
        })
      : null;
    const books = pageWide ? document.getElementsByClassName("book3d") : null;
    const track = () => {
      if (!io || !books) return;
      for (const el of Array.from(books)) {
        if (observed.has(el)) continue;
        observed.add(el);
        io.observe(el);
      }
    };
    const write = (v: string | null) => {
      if (!pageWide) {
        if (v === null) tgt.style.removeProperty(prop);
        else tgt.style.setProperty(prop, v);
        return;
      }
      for (const el of visible) {
        if (v === null) {
          el.style.removeProperty(prop);
          el.removeAttribute("data-swaying");
        } else {
          el.style.setProperty(prop, v);
          el.setAttribute("data-swaying", "");
        }
      }
    };

    let last = pos();
    let lastT = performance.now();
    let value = 0;
    let goal = 0;
    let raf = 0;

    const tick = () => {
      goal *= 0.86; // the push fades…
      value += (goal - value) * 0.18; // …and the book follows like a spring
      if (Math.abs(value) < 0.02 && Math.abs(goal) < 0.02) {
        value = 0;
        write(null);
        raf = 0;
        return;
      }
      write(value.toFixed(3));
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      const now = performance.now();
      const p = pos();
      const dt = Math.max(8, now - lastT);
      const v = (p - last) / dt; // px per ms
      last = p;
      lastT = now;
      goal = Math.max(-8, Math.min(8, goal * 0.5 + v * 3.2));
      if (!raf) {
        track();
        raf = requestAnimationFrame(tick);
      }
    };

    track();
    src.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      src.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      write(null);
      io?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Mount once: page-wide vertical sway for every live book. */
export function PageSway() {
  useSway(
    () => window,
    () => document.documentElement,
    "y",
  );
  return null;
}
