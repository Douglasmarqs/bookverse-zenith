import { useEffect } from "react";

/**
 * iOS Safari turns a drag from the screen edge into "go back a page in
 * history", sliding the previous screen in over a book. Cancelling touches
 * that start at the edges stops it; taps there are re-sent as clicks so
 * edge controls keep working. Panels, dialogs and fields are left alone.
 */
export function useEdgeSwipeGuard(enabled = true, edge = 22) {
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      if (t.clientX > edge && t.clientX < window.innerWidth - edge) {
        start = null;
        return;
      }
      const el = e.target as Element | null;
      if (el?.closest?.("[role=dialog], input, textarea, select, [contenteditable]")) return;
      if (e.cancelable) e.preventDefault();
      start = { x: t.clientX, y: t.clientY, t: performance.now() };
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      if (Math.hypot(t.clientX - s.x, t.clientY - s.y) < 10 && performance.now() - s.t < 600) {
        (document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null)?.click();
      }
    };
    document.addEventListener("touchstart", onStart, { passive: false, capture: true });
    document.addEventListener("touchend", onEnd, { capture: true });
    return () => {
      document.removeEventListener("touchstart", onStart, { capture: true });
      document.removeEventListener("touchend", onEnd, { capture: true });
    };
  }, [enabled, edge]);
}
