import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A Netflix/Apple-Books-style horizontal carousel: arrow buttons on
 * desktop/tablet (hover-friendly), native touch swipe on mobile, and
 * click-and-drag with the mouse. Snap-scrolling keeps cards aligned, and
 * soft edge gradients hint that there's more to scroll toward.
 *
 * Usage: wrap a row of cards exactly like the old
 * `<div className="flex overflow-x-auto ...">` — this is a drop-in
 * replacement, `children` are rendered as-is inside the scroll track.
 */
export function Carousel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScroll: number; moved: boolean } | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
    // Re-measure whenever children change too (list length can change).
  }, [updateArrows, children]);

  function scrollByPage(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return; // native touch scrolling already works
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = dragRef.current;
    const el = scrollerRef.current;
    if (!state || !el) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    el.scrollLeft = state.startScroll - dx;
  }

  function onPointerUp() {
    dragRef.current = dragRef.current ? { ...dragRef.current } : null;
  }

  // Suppress the click-through a Link child would otherwise get right
  // after a real drag gesture (so dragging never accidentally navigates).
  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (dragRef.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.moved = false;
    }
  }

  return (
    <div className="group/carousel relative">
      {canLeft && (
        <>
          <div className="pointer-events-none absolute -left-1 top-0 z-[5] hidden h-full w-16 bg-gradient-to-r from-background to-transparent md:block" />
          <button
            onClick={() => scrollByPage(-1)}
            aria-label="Ver anteriores"
            className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-2.5 text-foreground opacity-0 shadow-lg ring-1 ring-border/60 transition hover:bg-background group-hover/carousel:opacity-100 md:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}

      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className={`-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 [scrollbar-width:none] md:-mx-8 md:cursor-grab md:px-8 md:active:cursor-grabbing [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {children}
      </div>

      {canRight && (
        <>
          <div className="pointer-events-none absolute -right-1 top-0 z-[5] hidden h-full w-16 bg-gradient-to-l from-background to-transparent md:block" />
          <button
            onClick={() => scrollByPage(1)}
            aria-label="Ver mais"
            className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-2.5 text-foreground opacity-0 shadow-lg ring-1 ring-border/60 transition hover:bg-background group-hover/carousel:opacity-100 md:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
