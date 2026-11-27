import { startTransition, useEffect, useState, type ReactNode } from "react";

/**
 * Renders its children right after the screen's first frame, as a
 * low-priority (transition) update. React then builds them in small slices
 * between frames instead of one long block, so a screen change starts
 * animating at once and the sections further down arrive a beat later
 * without stalling anything. Use it for content below the fold only.
 */
export function Deferred({
  children,
  minHeight = 0,
}: {
  children: ReactNode;
  /** Space kept while waiting, so the page doesn't jump. */
  minHeight?: number;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => startTransition(() => setReady(true)));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  if (ready) return <>{children}</>;
  return minHeight ? <div aria-hidden style={{ minHeight }} /> : null;
}
