/**
 * "Abertura" — the app's opening sequence.
 *
 * A vermilion book rises out of the dark, swings open, light pours from
 * its pages, Lumi slowly climbs out to wave, classic covers fly into orbit
 * while the reasons to stay appear one by one — then everything folds into
 * the BookVerse mark and the scene fades onto the app.
 *
 * Smoothness: the whole timeline is plain CSS keyframes that only move and
 * fade layers (transform/opacity), so the browser runs it on the
 * compositor — it stays fluid while the app hydrates and loads underneath,
 * and it starts with the very first paint (no waiting for JavaScript).
 * JS only handles skipping and removing the overlay at the end.
 *
 * - First visit: full (~7 s). Later sessions: short (~3 s). Reduce motion:
 *   a calm logo. Tap, Esc or "Pular" skips. Never on a reader deep link.
 * - A boot script in <head> sets html[data-intro] before the first paint;
 *   the styles in styles.css ("Abertura") key every timing off it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Headphones, Languages, Library, Sparkles } from "lucide-react";

import { Lumi } from "@/components/brand/lumi";
import { DONE_EVENT, SEEN_KEY, SESSION_KEY } from "@/lib/intro";

const W = 132;
const H = 186;

const COVERS = [
  { t: "Dom Casmurro", bg: "#1f3b2f", fg: "#e9c46a" },
  { t: "Os Maias", bg: "#6d1f2a", fg: "#f3e3c3" },
  { t: "Frankenstein", bg: "#22344a", fg: "#cfe0f3" },
  { t: "Iracema", bg: "#c4572a", fg: "#fff4e2" },
  { t: "O Cortiço", bg: "#4b3a5c", fg: "#f0dcff" },
  { t: "Orgulho e Preconceito", bg: "#e8dcc4", fg: "#5a3b22" },
  { t: "Os Lusíadas", bg: "#0f4c5c", fg: "#f6d58e" },
  { t: "A Relíquia", bg: "#2a2622", fg: "#ff8a5c" },
];
/** Orbit slots on an ellipse over the book (angles in degrees). */
const SLOTS = [196, 214, 234, 252, 288, 306, 326, 344];

const REASONS = [
  { icon: Library, text: "78 mil livros grátis e legais" },
  { icon: Headphones, text: "Vozes naturais que narram o livro" },
  { icon: Sparkles, text: "A Lumi lê junto e tira dúvidas" },
  { icon: Languages, text: "Em português e inglês" },
];

/** Deterministic sprinkle of dust motes (same markup on server and client). */
const MOTES = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => (Math.sin(i * 97.13 + n * 13.7) + 1) / 2;
  return {
    left: `${(r(1) * 100).toFixed(1)}%`,
    top: `${(35 + r(2) * 60).toFixed(1)}%`,
    size: 3 + Math.round(r(3) * 3),
    delay: `${(r(4) * 2.4).toFixed(2)}s`,
    dur: `${(3.4 + r(5) * 2.6).toFixed(2)}s`,
  };
});

const vars = (v: Record<string, string | number>) => v as CSSProperties;

export function AppIntro() {
  const [gone, setGone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ended = useRef(false);

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    const d = document.documentElement;
    d.setAttribute("data-intro", "off");
    d.style.removeProperty("overflow");
    d.style.removeProperty("background");
    setGone(true);
    window.dispatchEvent(new Event(DONE_EVENT));
  }, []);

  const skip = useCallback(() => {
    const el = ref.current;
    if (!el || el.classList.contains("is-skipping")) return;
    el.classList.add("is-skipping");
    // The app underneath was hidden until the end of the show.
    document.documentElement.classList.add("intro-reveal");
  }, []);

  useEffect(() => {
    const d = document.documentElement;
    const m = d.getAttribute("data-intro");
    const el = ref.current;
    if (!el || (m !== "full" && m !== "short" && m !== "calm")) {
      setGone(true);
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
      // Seen once (even if skipped): later visits get the short version.
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage unavailable
    }
    d.style.overflow = "hidden";

    const onEnd = (e: AnimationEvent) => {
      if (e.target === el && (e.animationName === "ib-out" || e.animationName === "ib-skip"))
        finish();
    };
    el.addEventListener("animationend", onEnd);
    // Slow devices may hydrate after the show already ended.
    const anims = el.getAnimations?.() ?? [];
    if (anims.length && anims.every((a) => a.playState === "finished")) finish();
    const fallback = setTimeout(finish, 11_000);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("animationend", onEnd);
      window.removeEventListener("keydown", onKey);
      clearTimeout(fallback);
    };
  }, [finish, skip]);

  if (gone) return null;

  return (
    <div
      id="app-intro"
      ref={ref}
      role="dialog"
      aria-label="Abertura do BookVerse"
      onClick={skip}
      className="fixed inset-0 z-[200] cursor-pointer select-none overflow-hidden text-[#f4f3ef]"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Dust in the lamplight */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          aria-hidden
          className="ib-mote absolute rounded-full"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            animationDelay: m.delay,
            animationDuration: m.dur,
          }}
        />
      ))}

      {/* Warm glow that blooms when the book opens */}
      <div aria-hidden className="ib-glow pointer-events-none absolute left-1/2 top-[40%]" />

      {/* ——— Book scene ——— */}
      <div className="ib-stage absolute inset-0">
        <div className="absolute inset-0 [transform-origin:50%_40%] lg:scale-[1.3] min-[1800px]:scale-[1.5]">
          <div
            className="ib-scene absolute left-1/2 top-[40%]"
            style={{ width: W * 2, height: H, marginLeft: -W, marginTop: -H / 2 }}
          >
            {/* Covers flying out into orbit */}
            {COVERS.map((c, i) => {
              const a = (SLOTS[i]! * Math.PI) / 180;
              const x = Math.round(Math.cos(a) * 168);
              const y = Math.round(Math.sin(a) * 136 - 18);
              const rot = ((i * 37) % 30) - 15;
              return (
                <div
                  key={c.t}
                  aria-hidden
                  className="ib-cover absolute left-1/2 top-1/2 h-[50px] w-[35px] overflow-hidden rounded-[4px]"
                  style={{
                    background: c.bg,
                    color: c.fg,
                    marginLeft: -17,
                    marginTop: -25,
                    ...vars({ "--x": `${x}px`, "--y": `${y}px`, "--r": `${rot}deg`, "--i": i }),
                  }}
                >
                  <span
                    className="absolute inset-x-0 top-[7px] h-[2px] opacity-60"
                    style={{ background: c.fg }}
                  />
                  <span
                    className="absolute inset-x-[2px] top-[13px] text-center font-display text-[5px] font-bold leading-[1.15]"
                    style={{ overflowWrap: "normal", wordBreak: "keep-all", hyphens: "none" }}
                  >
                    {c.t}
                  </span>
                  <span
                    className="absolute inset-x-0 bottom-[6px] h-[2px] opacity-40"
                    style={{ background: c.fg }}
                  />
                </div>
              );
            })}

            {/* Light pouring from the gutter */}
            <div aria-hidden className="ib-flare pointer-events-none absolute left-1/2 top-1/2" />

            {/* The book */}
            <div className="ib-book-fade absolute inset-0">
              <div className="ib-book absolute top-0" style={{ left: W / 2, width: W, height: H }}>
                {/* Page block (right-hand page once open) */}
                <div className="ib-pages absolute inset-0 overflow-hidden rounded-l-[2px] rounded-r-[6px]">
                  <div className="absolute inset-x-[16px] top-[22px] space-y-[7px]">
                    {Array.from({ length: 13 }, (_, i) => (
                      <div
                        key={i}
                        className="ib-line h-[3px] rounded-full bg-[#2a2620]/25"
                        style={{
                          width: i % 5 === 4 ? "58%" : `${88 - ((i * 7) % 14)}%`,
                          ...vars({ "--i": i }),
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Leaves flipping over; the top one carries the left page */}
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="ib-leaf absolute inset-0 rounded-r-[6px]"
                    style={vars({ "--i": i, "--end": `${-172 + i * 1.6}deg` })}
                  >
                    {i === 3 && (
                      <div className="absolute inset-x-[16px] top-[22px] space-y-[7px]">
                        {Array.from({ length: 13 }, (_, k) => (
                          <div
                            key={k}
                            className="ml-auto h-[3px] rounded-full bg-[#2a2620]/20"
                            style={{ width: k % 5 === 4 ? "52%" : `${86 - ((k * 11) % 16)}%` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Cover: front in vermilion, inside in deep ink */}
                <div className="ib-cover-hinge absolute inset-0">
                  <div className="ib-cover-front absolute inset-0 overflow-hidden rounded-l-[3px] rounded-r-[7px]">
                    <div className="absolute inset-[10px] rounded-[4px] border border-[#ffd9c4]/45" />
                    <div className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2">
                      <svg viewBox="0 0 40 40" width="56" height="56" aria-hidden>
                        <path
                          d="M10 12.5c3.6-1.4 7-.9 10 1.6v15.2c-3-2.5-6.4-3-10-1.6V12.5Z"
                          fill="#1a0f0b"
                        />
                        <path
                          d="M30 12.5c-3.6-1.4-7-.9-10 1.6v15.2c3-2.5 6.4-3 10-1.6V12.5Z"
                          fill="#fff1e8"
                        />
                      </svg>
                    </div>
                    <p className="absolute inset-x-0 bottom-[30px] text-center font-display text-[17px] font-[760] tracking-[-0.04em] text-[#fff1e8]">
                      bookverse
                    </p>
                    <div aria-hidden className="ib-shine absolute inset-y-0 w-[45%]" />
                  </div>
                  <div className="ib-cover-back absolute inset-0 rounded-l-[7px] rounded-r-[3px]" />
                </div>
              </div>
            </div>

            {/* Lumi climbs out of the pages, then waves */}
            <div className="ib-lumi absolute left-1/2 top-0" style={{ marginLeft: -44 }}>
              <div className="ib-lumi-wave">
                <Lumi pose="hello" size={88} />
              </div>
            </div>
          </div>
        </div>

        {/* Why BookVerse */}
        <ul className="ib-reasons absolute bottom-[calc(env(safe-area-inset-bottom)+6vh)] left-1/2 flex w-[min(330px,88vw)] -translate-x-1/2 flex-col gap-2">
          {REASONS.map((r, i) => {
            const Icon = r.icon;
            return (
              <li
                key={r.text}
                className="ib-reason flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-[13.5px] font-semibold"
                style={vars({ "--i": i })}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ff4d1a] text-white">
                  <Icon className="h-[15px] w-[15px]" strokeWidth={2.4} />
                </span>
                {r.text}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ——— The mark ——— */}
      <div className="ib-brand absolute inset-x-0 top-[40%] flex -translate-y-[45%] flex-col items-center">
        <div className="ib-mark relative">
          {[0, 1].map((i) => (
            <span
              key={i}
              aria-hidden
              className="ib-ring absolute inset-0 rounded-[28px] border-2 border-[#ff4d1a]"
              style={vars({ "--i": i })}
            />
          ))}
          <svg viewBox="0 0 40 40" width="92" height="92" aria-hidden>
            <rect width="40" height="40" rx="12" fill="#f3f2ee" />
            <path d="M10 12.5c3.6-1.4 7-.9 10 1.6v15.2c-3-2.5-6.4-3-10-1.6V12.5Z" fill="#0c0c0e" />
            <path d="M30 12.5c-3.6-1.4-7-.9-10 1.6v15.2c3-2.5 6.4-3 10-1.6V12.5Z" fill="#ff4d1a" />
          </svg>
        </div>
        <p className="mt-5 flex font-display text-[44px] font-[760] leading-none tracking-[-0.045em]">
          {"bookverse".split("").map((ch, i) => (
            <span key={i} className="ib-letter inline-block" style={vars({ "--i": i })}>
              {ch}
            </span>
          ))}
        </p>
        <p className="ib-tagline mt-3 text-center text-[15px] font-medium text-[#f4f3ef]/75">
          Ler, ouvir e descobrir. <span className="text-[#ff7a4f]">De graça.</span>
        </p>
      </div>

      {/* Skip */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
        className="ib-skip absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white/85"
      >
        Pular
      </button>
    </div>
  );
}
