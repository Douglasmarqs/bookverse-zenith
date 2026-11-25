import { useRef, useState } from "react";

import { FauxCover } from "@/components/faux-cover";
import { fauxBookFor } from "@/lib/faux-books";

/**
 * A book's cover: the generated "capa viva" art underneath, the real artwork
 * fading in on top when there is one (and silently staying hidden if the
 * image fails). Always 2:3 with the shared book shadow.
 */
export function BookArt({
  title,
  author,
  cover,
  className = "",
  lift = false,
  showText = true,
  eager = false,
  live = false,
}: {
  title: string;
  author?: string;
  cover?: string | null;
  className?: string;
  lift?: boolean;
  showText?: boolean;
  eager?: boolean;
  /**
   * A physical book: tilts in 3D toward the cursor (or finger) with a glare
   * and the page block showing on its side, and sways with scroll speed.
   */
  live?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const art = (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[4px_8px_8px_4px] ${
        lift ? "book-shadow-lift" : "book-shadow"
      } ${className}`}
    >
      <FauxCover
        book={fauxBookFor(title, author)}
        showText={showText}
        className="absolute inset-0 h-full w-full"
      />
      {cover && state !== "error" && (
        <img
          src={cover}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            state === "ok" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {/* Spine light, so real covers read as objects too. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgb(0 0 0 / .26), rgb(255 255 255 / .12) 5%, rgb(0 0 0 / .05) 9%, transparent 20%)",
        }}
      />
    </div>
  );
  return live ? <LiveBook>{art}</LiveBook> : art;
}

/** 3D shell around a cover — all motion runs through CSS variables. */
function LiveBook({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const aim = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${((x - 0.5) * 36).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${((0.5 - y) * 20).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      // Pressing the right side back shows the block of pages.
      el.style.setProperty("--edge", `${(Math.max(0, x - 0.35) * 0.09 * r.width).toFixed(1)}px`);
    });
  };
  const rest = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.removeAttribute("data-live");
    el.style.removeProperty("--ry");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--edge");
  };

  return (
    <div
      ref={ref}
      className="book3d"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") ref.current?.setAttribute("data-live", "hover");
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse" || ref.current?.dataset.live === "press") aim(e);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        ref.current?.setAttribute("data-live", "press");
        aim(e);
      }}
      onPointerUp={(e) => e.pointerType !== "mouse" && rest()}
      onPointerCancel={rest}
      onPointerLeave={rest}
    >
      <div className="book3d-body">
        {children}
        <span aria-hidden className="book3d-pages" />
        <span aria-hidden className="book3d-glare" />
      </div>
    </div>
  );
}
