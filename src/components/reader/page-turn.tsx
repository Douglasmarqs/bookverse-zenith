/**
 * Page-turn stage. While a page turns, the real (paginated) column is
 * hidden under an opaque stage that shows the two pages involved, cut out
 * of a snapshot of the already-rendered chapter. Each style is a function
 * of one number `p` (0 = start, 1 = turned), applied straight to the DOM so
 * the animation — or the page following your finger — runs at full frame
 * rate without React re-rendering.
 *
 * Styles: folha (paper fold that follows the finger), deslizar (next page
 * slides over), esmaecer (quick cross-fade). "instantaneo" never uses it.
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

import type { TurnStyle } from "@/lib/reader-store";

export interface TurnStageHandle {
  /** Sets the turn progress, 0–1. */
  set: (p: number) => void;
}

interface Props {
  snapshot: string;
  /** Scroll stride of one page (or spread). */
  pageWidth: number;
  /** Width of one CSS column (half the stride in two-page mode). */
  columnWidth: number;
  from: number;
  to: number;
  style: Exclude<TurnStyle, "instantaneo">;
  bg: string;
  fg: string;
  /** Padding of the paginated column, so the copy lines up exactly. */
  padding: string;
}

function Page({
  html,
  index,
  pageWidth,
  columnWidth,
  bg,
  fg,
  padding,
  className = "",
}: {
  html: string;
  index: number;
  pageWidth: number;
  columnWidth: number;
  bg: string;
  fg: string;
  padding: string;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ background: bg, color: fg, contain: "strict" }}
    >
      <div
        style={{
          width: `${pageWidth}px`,
          height: "100%",
          columnWidth: `${columnWidth}px`,
          columnGap: "0px",
          columnFill: "auto",
          padding,
          boxSizing: "border-box",
          transform: `translateX(${-index * pageWidth}px)`,
        }}
        // A copy of our own rendered article, never raw book markup.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export const TurnStage = forwardRef<TurnStageHandle, Props>(function TurnStage(
  { snapshot, pageWidth, columnWidth, from, to, style, bg, fg, padding },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const under = useRef<HTMLDivElement>(null);
  const underShade = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const topShade = useRef<HTMLDivElement>(null);
  const flapWrap = useRef<HTMLDivElement>(null);
  const flap = useRef<HTMLDivElement>(null);
  const flapShade = useRef<HTMLDivElement>(null);
  const forward = to > from;
  // Which page sits underneath and which one moves.
  const underIndex = style === "folha" ? (forward ? to : from) : forward ? from : to;
  const topIndex = style === "folha" ? (forward ? from : to) : forward ? to : from;

  const lastP = useRef(0);
  // Measured once per turn: reading layout inside the per-frame update would
  // force a synchronous re-layout of the whole stage on every frame (the
  // main cause of stutter on phones).
  const size = useRef<{ w: number; h: number } | null>(null);
  const apply = (pRaw: number) => {
    const p = Math.max(0, Math.min(1, pRaw));
    lastP.current = p;
    if (!size.current && root.current) {
      size.current = { w: root.current.clientWidth, h: root.current.clientHeight };
    }
    const W = size.current?.w ?? pageWidth;
    const H = size.current?.h ?? 800;
    const u = under.current,
      t = top.current;
    if (!u || !t) return;

    if (style === "esmaecer") {
      // under = from, top = to (forward) — both directions just cross-fade.
      const showTo = forward ? p : 1 - p;
      t.style.opacity = String(forward ? showTo : 1 - p);
      u.style.opacity = String(forward ? 1 - p : p);
      return;
    }

    if (style === "deslizar") {
      const sn = Math.sin(p * Math.PI);
      if (forward) {
        u.style.transform = `translateX(${-28 * p}%)`;
        u.style.filter = `brightness(${1 - 0.08 * p})`;
        t.style.transform = `translateX(${100 - 100 * p}%)`;
      } else {
        u.style.transform = `translateX(${-28 * (1 - p)}%)`;
        u.style.filter = `brightness(${1 - 0.08 * (1 - p)})`;
        t.style.transform = `translateX(${100 * p}%)`;
      }
      t.style.boxShadow = `-18px 0 30px -12px rgba(0,0,0,${0.35 * sn + 0.05})`;
      return;
    }

    // folha — a flat paper fold. f = how folded the moving page is.
    const f = forward ? p : 1 - p;
    const sn = Math.sin(f * Math.PI);
    const xb = W - (W + 90) * f;
    const tilt = 110 * sn + 10 * (1 - f);
    const xt = xb + tilt;
    const dx = xt - xb,
      dy = -H;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len,
      uy = dy / len;
    const a = 2 * ux * ux - 1,
      b = 2 * ux * uy,
      c = 2 * ux * uy,
      d = 2 * uy * uy - 1;
    const e = xb - (a * xb + c * H),
      g = H - (b * xb + d * H);
    const right = `polygon(${xt}px 0px, ${W + 400}px 0px, ${W + 400}px ${H}px, ${xb}px ${H}px)`;
    const left = `polygon(-400px 0px, ${xt}px 0px, ${xb}px ${H}px, -400px ${H}px)`;
    const xmin = Math.min(xt, xb);
    t.style.clipPath = left;
    // Shading strips are static gradients that just slide with the fold
    // (transform + opacity only — no gradient rebuilt per frame).
    if (topShade.current) {
      topShade.current.style.transform = `translateX(${xmin - 90}px)`;
      topShade.current.style.opacity = String(sn);
    }
    if (underShade.current) {
      underShade.current.style.clipPath = right;
      underShade.current.style.transform = `translateX(${xmin}px)`;
      underShade.current.style.opacity = String(0.15 + 0.85 * sn);
    }
    if (flap.current && flapWrap.current) {
      flap.current.style.transform = `matrix(${a},${b},${c},${d},${e},${g})`;
      flap.current.style.clipPath = right;
      if (flapShade.current) flapShade.current.style.transform = `translateX(${xmin}px)`;
      flapWrap.current.style.visibility = f <= 0.001 ? "hidden" : "visible";
    }
  };

  useImperativeHandle(ref, () => ({ set: apply }));
  // Paint the current frame before the browser shows the stage (and keep it
  // on any re-render while the finger is still down).
  useLayoutEffect(() => apply(lastP.current));

  const pageProps = { html: snapshot, pageWidth, columnWidth, bg, fg, padding };
  // Paper-back colours, computed once per turn instead of every frame.
  const flapBase = `color-mix(in oklab, ${bg} 86%, #000)`;
  const flapGradient = `linear-gradient(90deg, color-mix(in oklab, ${bg} 82%, #000) 0px, color-mix(in oklab, ${bg} 96%, #fff) 50px, color-mix(in oklab, ${bg} 92%, #000) 160px, color-mix(in oklab, ${bg} 86%, #000) 100%)`;
  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      style={{ background: bg }}
    >
      <div ref={under} className="absolute inset-0 will-change-transform">
        <Page {...pageProps} index={underIndex} />
      </div>
      {style === "folha" && (
        <div ref={underShade} className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-[110px] will-change-transform"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,.35), rgba(0,0,0,0))" }}
          />
        </div>
      )}
      <div ref={top} className="absolute inset-0 will-change-transform">
        <Page {...pageProps} index={topIndex} />
        {style === "folha" && (
          <div
            ref={topShade}
            className="absolute inset-y-0 left-0 w-[90px] will-change-transform"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,.1))" }}
          />
        )}
      </div>
      {style === "folha" && (
        <div ref={flapWrap} className="absolute inset-0">
          <div
            ref={flap}
            className="absolute inset-0 overflow-hidden will-change-transform"
            style={{ transformOrigin: "0 0", background: flapBase }}
          >
            {/* Highlight + crease, built once and slid along the fold. */}
            <div
              ref={flapShade}
              className="absolute inset-y-0 left-0 w-[200%]"
              style={{ background: flapGradient }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

/** Eases a value with requestAnimationFrame; returns a cancel function. */
export function tween(
  fromP: number,
  toP: number,
  ms: number,
  onFrame: (p: number) => void,
  onDone: () => void,
) {
  const start = performance.now();
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let raf = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / Math.max(1, ms));
    onFrame(fromP + (toP - fromP) * ease(t));
    if (t < 1) raf = requestAnimationFrame(step);
    else onDone();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export const TURN_MS: Record<Exclude<TurnStyle, "instantaneo">, number> = {
  folha: 620,
  deslizar: 380,
  esmaecer: 220,
};
