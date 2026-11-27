/**
 * "Abertura" — the app's opening sequence.
 *
 * A vermilion book rises out of the dark, swings open, light pours from
 * its pages, Lumi pops out to wave, classic covers fly into orbit while the
 * reasons to stay appear one by one — then everything folds into the
 * BookVerse mark and an iris opens onto the app.
 *
 * - First visit: the full sequence (~5 s). Later sessions: a short one
 *   (~2 s). "Reduce motion": a calm fade. Tap anywhere to skip.
 * - Never on a deep link into the reader, so shared books open at once.
 * - The overlay is server-rendered and a boot script decides before the
 *   first paint whether it shows, so the app never flashes underneath.
 */
import { motion, type Transition } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Languages, Library, Sparkles } from "lucide-react";

import { Lumi } from "@/components/brand/lumi";

type Mode = "full" | "short" | "calm";
const SEEN_KEY = "bookverse:intro-seen";
const SESSION_KEY = "bookverse:intro-session";

/** Runs in <head> before paint: sets html[data-intro] to the mode or "off". */
export const INTRO_BOOT_SCRIPT = `(function(){var d=document.documentElement,m='off';try{var p=location.pathname,s=location.search;var skip=/^\\/(reader|api)\\//.test(p)||/[?&]intro=0/.test(s)||sessionStorage.getItem('${SESSION_KEY}');if(!skip){m=localStorage.getItem('${SEEN_KEY}')?'short':'full';if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)m='calm';}}catch(e){m='off'}d.setAttribute('data-intro',m);if(m!=='off')d.style.background='#09090b';})();`;

/** Stage times in ms: 1 open · 2 burst · 3 reasons · 4 logo · 5 exit. */
const TIMELINE: Record<Mode, [number, number, number, number, number]> = {
  full: [750, 1500, 1950, 4300, 5700],
  short: [380, 700, 99999, 1250, 2250],
  calm: [99999, 99999, 99999, 0, 1100],
};

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

const spring: Transition = { type: "spring", stiffness: 120, damping: 16 };
const ease = [0.22, 1, 0.36, 1] as const;

/** Deterministic sprinkle of dust motes (no hydration mismatch). */
const MOTES = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 97.13 + n * 13.7) + 1) / 2) % 1;
  return {
    left: `${(r(1) * 100).toFixed(1)}%`,
    top: `${(35 + r(2) * 60).toFixed(1)}%`,
    size: 2 + Math.round(r(3) * 3),
    delay: `${(r(4) * 2.4).toFixed(2)}s`,
    dur: `${(3.2 + r(5) * 2.6).toFixed(2)}s`,
  };
});

export function AppIntro() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [stage, setStage] = useState(0);
  const [gone, setGone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = useCallback(() => {
    setGone(true);
    const d = document.documentElement;
    d.setAttribute("data-intro", "off");
    d.style.removeProperty("overflow");
    d.style.removeProperty("background");
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage unavailable
    }
  }, []);

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setStage(5);
  }, []);

  useEffect(() => {
    const d = document.documentElement;
    const m = d.getAttribute("data-intro");
    if (m !== "full" && m !== "short" && m !== "calm") {
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
    setMode(m);
    timers.current = TIMELINE[m].map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      timers.current.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [skip]);

  if (gone) return null;
  const full = mode === "full";
  const calm = mode === "calm";

  return (
    <motion.div
      id="app-intro"
      role="dialog"
      aria-label="Abertura do BookVerse"
      onClick={skip}
      className="fixed inset-0 z-[200] cursor-pointer select-none overflow-hidden text-[#f4f3ef]"
      style={{
        background: "radial-gradient(120% 80% at 50% 42%, #2a1610 0%, #120c0b 45%, #09090b 100%)",
        fontFamily: "var(--font-sans)",
      }}
      initial={false}
      animate={
        stage >= 5
          ? calm
            ? { opacity: 0 }
            : { clipPath: "circle(0% at 50% 40%)" }
          : { clipPath: "circle(150% at 50% 40%)", opacity: 1 }
      }
      transition={{ duration: calm ? 0.5 : 0.8, ease: [0.7, 0, 0.3, 1] }}
      onAnimationComplete={(def) => {
        // Only the closing iris/fade ends the intro (not an interrupted one).
        const d = def as { clipPath?: string; opacity?: number };
        if (stage >= 5 && (d.clipPath?.startsWith("circle(0%") || d.opacity === 0)) finish();
      }}
    >
      {mode && (
        <>
          {/* Dust in the lamplight */}
          {!calm &&
            MOTES.map((m, i) => (
              <span
                key={i}
                aria-hidden
                className="intro-mote absolute rounded-full bg-[#ffcf9e]"
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
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[40%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,110,50,.55), rgba(255,77,26,.18) 55%, transparent)",
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={
              stage >= 4
                ? { opacity: 0.55, scale: 0.75 }
                : stage >= 2
                  ? { opacity: [0, 1, 0.75], scale: [0.5, 1.25, 1] }
                  : { opacity: 0.25, scale: 0.6 }
            }
            transition={{ duration: stage >= 2 && stage < 4 ? 1.1 : 0.8, ease }}
          />

          {/* ——— Book scene ——— */}
          {!calm && (
            <div className="absolute inset-0">
              <div className="absolute inset-0 [transform-origin:50%_40%] lg:scale-[1.3] min-[1800px]:scale-[1.5]">
                <motion.div
                  className="absolute left-1/2 top-[40%]"
                  style={{
                    width: W * 2,
                    height: H,
                    marginLeft: -W,
                    marginTop: -H / 2,
                    perspective: 1100,
                  }}
                  animate={
                    stage >= 4
                      ? { scale: 0.35, opacity: 0, y: -10, filter: "blur(6px)" }
                      : { scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }
                  }
                  transition={{ duration: 0.55, ease }}
                >
                  {/* Covers flying out into orbit */}
                  {full &&
                    COVERS.map((c, i) => {
                      const a = (SLOTS[i]! * Math.PI) / 180;
                      const x = Math.cos(a) * 168;
                      const y = Math.sin(a) * 136 - 18;
                      const rot = ((i * 37) % 30) - 15;
                      return (
                        <motion.div
                          key={c.t}
                          aria-hidden
                          className="absolute left-1/2 top-1/2 h-[50px] w-[35px] overflow-hidden rounded-[4px] shadow-[0_8px_18px_-6px_rgba(0,0,0,.7)]"
                          style={{ background: c.bg, color: c.fg, marginLeft: -17, marginTop: -25 }}
                          initial={{ x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }}
                          animate={
                            stage >= 4
                              ? { x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }
                              : stage >= 2
                                ? {
                                    x: [0, x * 0.55, x],
                                    y: [0, y - 70, y],
                                    scale: [0.2, 1.15, 1],
                                    opacity: [0, 1, 1],
                                    rotate: [0, rot * 2, rot],
                                  }
                                : { x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }
                          }
                          transition={
                            stage >= 4
                              ? { duration: 0.45, delay: i * 0.02, ease }
                              : { duration: 0.95, delay: 0.12 + i * 0.07, ease }
                          }
                        >
                          <span
                            className="absolute inset-x-0 top-[7px] h-[2px] opacity-60"
                            style={{ background: c.fg }}
                          />
                          <span
                            className="absolute inset-x-[2px] top-[13px] text-center font-display text-[5px] font-bold leading-[1.15]"
                            style={{
                              overflowWrap: "normal",
                              wordBreak: "keep-all",
                              hyphens: "none",
                            }}
                          >
                            {c.t}
                          </span>
                          <span
                            className="absolute inset-x-0 bottom-[6px] h-[2px] opacity-40"
                            style={{ background: c.fg }}
                          />
                        </motion.div>
                      );
                    })}

                  {/* Light pouring from the gutter */}
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
                    style={{
                      background:
                        "radial-gradient(closest-side, rgba(255,240,210,.95), rgba(255,170,90,.45) 40%, transparent 75%)",
                    }}
                    initial={{ opacity: 0, scale: 0.2 }}
                    animate={
                      stage >= 4
                        ? { opacity: 0, scale: 0.3 }
                        : stage >= 2
                          ? { opacity: [0, 1, 0.55], scale: [0.2, 1.3, 1] }
                          : { opacity: 0, scale: 0.2 }
                    }
                    transition={{ duration: 0.9, ease }}
                  />

                  {/* The book */}
                  <motion.div
                    className="absolute top-0"
                    style={{ left: W / 2, width: W, height: H, transformStyle: "preserve-3d" }}
                    initial={{ y: 160, rotateX: 38, rotateZ: -6, opacity: 0, scale: 0.8 }}
                    animate={{
                      y: 0,
                      rotateX: stage >= 1 ? 8 : 18,
                      rotateZ: stage >= 1 ? 0 : -3,
                      opacity: 1,
                      scale: 1,
                      x: stage >= 1 ? W / 2 : 0,
                    }}
                    transition={{ ...spring, x: { duration: 0.7, ease } }}
                  >
                    {/* Page block (right-hand page once open) */}
                    <div
                      className="absolute inset-0 overflow-hidden rounded-r-[6px] rounded-l-[2px]"
                      style={{
                        background:
                          "linear-gradient(90deg, #d9cfbb 0%, #f6efe0 9%, #fbf6ec 70%, #efe5d2 100%)",
                        boxShadow:
                          "inset -3px 0 0 #e2d6c0, inset -5px 0 0 #f4ecdc, inset -7px 0 0 #ded1b9, 0 24px 50px -18px rgba(0,0,0,.8)",
                      }}
                    >
                      <div className="absolute inset-x-[16px] top-[22px] space-y-[7px]">
                        {Array.from({ length: 13 }, (_, i) => (
                          <motion.div
                            key={i}
                            className="h-[3px] rounded-full bg-[#2a2620]/25"
                            style={{ width: i % 5 === 4 ? "58%" : `${88 - ((i * 7) % 14)}%` }}
                            initial={{ scaleX: 0, originX: 0 }}
                            animate={{ scaleX: stage >= 2 ? 1 : 0 }}
                            transition={{ duration: 0.35, delay: 0.05 + i * 0.04, ease }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Leaves flipping over */}
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        aria-hidden
                        className="absolute inset-0 rounded-r-[6px]"
                        style={{
                          transformOrigin: "left center",
                          background: "linear-gradient(90deg, #e9dfcb, #fbf6ec 30%, #f3ead8)",
                          boxShadow: "inset 1px 0 0 rgba(0,0,0,.06)",
                        }}
                        initial={{ rotateY: 0, opacity: 0 }}
                        animate={
                          stage >= 1
                            ? { rotateY: -176 + i * 1.5, opacity: [0, 1, 1, 0.9] }
                            : { rotateY: 0, opacity: 0 }
                        }
                        transition={{
                          duration: 0.75,
                          delay: 0.18 + i * 0.09,
                          ease: [0.45, 0, 0.2, 1],
                        }}
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
                      </motion.div>
                    ))}

                    {/* Cover: front in vermilion, inside in deep ink */}
                    <motion.div
                      className="absolute inset-0"
                      style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
                      animate={{ rotateY: stage >= 1 ? -172 : 0 }}
                      transition={{ duration: 0.85, ease: [0.55, 0, 0.2, 1] }}
                    >
                      <div
                        className="absolute inset-0 overflow-hidden rounded-r-[7px] rounded-l-[3px]"
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          background:
                            "linear-gradient(100deg, #b8320f 0%, #ff4d1a 14%, #ff6a3a 55%, #e7461a 100%)",
                          boxShadow:
                            "inset 6px 0 0 rgba(0,0,0,.18), inset 8px 0 0 rgba(255,255,255,.12), 0 30px 60px -20px rgba(0,0,0,.85)",
                        }}
                      >
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
                        <motion.div
                          aria-hidden
                          className="absolute inset-y-0 w-[45%] -skew-x-12"
                          style={{
                            background:
                              "linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)",
                          }}
                          initial={{ x: "-120%" }}
                          animate={{ x: "320%" }}
                          transition={{ duration: 0.9, delay: 0.2, ease }}
                        />
                      </div>
                      <div
                        className="absolute inset-0 rounded-l-[7px] rounded-r-[3px]"
                        style={{
                          transform: "rotateY(180deg)",
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          background:
                            "repeating-linear-gradient(45deg, #2a140d 0 6px, #331a11 6px 12px)",
                          boxShadow: "inset -6px 0 10px rgba(0,0,0,.35)",
                        }}
                      />
                    </motion.div>
                  </motion.div>

                  {/* Lumi pops out of the pages */}
                  <motion.div
                    className="absolute left-1/2 top-0"
                    style={{ marginLeft: -44 }}
                    initial={{ y: 40, scale: 0, opacity: 0 }}
                    animate={
                      stage >= 2
                        ? { y: -86, scale: 1, opacity: 1, rotate: [0, -8, 6, 0] }
                        : { y: 40, scale: 0, opacity: 0 }
                    }
                    transition={{
                      type: "spring",
                      stiffness: 210,
                      damping: 13,
                      rotate: { duration: 1.2, delay: 0.3 },
                    }}
                  >
                    <Lumi pose="hello" size={88} />
                  </motion.div>
                </motion.div>
              </div>

              {/* Why BookVerse */}
              {full && (
                <ul className="absolute bottom-[calc(env(safe-area-inset-bottom)+6vh)] left-1/2 flex w-[min(330px,88vw)] -translate-x-1/2 flex-col gap-2">
                  {REASONS.map((r, i) => {
                    const Icon = r.icon;
                    return (
                      <motion.li
                        key={r.text}
                        className="flex items-center gap-3 whitespace-nowrap rounded-full bg-white/[.07] px-4 py-2.5 text-[13.5px] font-semibold backdrop-blur-sm"
                        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}
                        initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                        animate={
                          stage >= 4
                            ? { opacity: 0, y: -8, filter: "blur(6px)" }
                            : stage >= 3
                              ? { opacity: 1, y: 0, filter: "blur(0px)" }
                              : { opacity: 0, y: 18, filter: "blur(6px)" }
                        }
                        transition={{
                          duration: 0.5,
                          delay: stage >= 4 ? i * 0.03 : i * 0.28,
                          ease,
                        }}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ff4d1a] text-white">
                          <Icon className="h-[15px] w-[15px]" strokeWidth={2.4} />
                        </span>
                        {r.text}
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ——— The mark ——— */}
          {stage >= 4 && (
            <div className="absolute inset-x-0 top-[40%] flex -translate-y-[45%] flex-col items-center">
              <motion.div
                className="relative"
                initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 14 }}
              >
                {!calm &&
                  [0, 1].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      className="absolute inset-0 rounded-[28px] border-2 border-[#ff4d1a]"
                      initial={{ scale: 1, opacity: 0.8 }}
                      animate={{ scale: 2.3, opacity: 0 }}
                      transition={{ duration: 1.1, delay: 0.1 + i * 0.25, ease: "easeOut" }}
                    />
                  ))}
                <svg viewBox="0 0 40 40" width="92" height="92" aria-hidden>
                  <rect width="40" height="40" rx="12" fill="#f3f2ee" />
                  <path
                    d="M10 12.5c3.6-1.4 7-.9 10 1.6v15.2c-3-2.5-6.4-3-10-1.6V12.5Z"
                    fill="#0c0c0e"
                  />
                  <path
                    d="M30 12.5c-3.6-1.4-7-.9-10 1.6v15.2c3-2.5 6.4-3 10-1.6V12.5Z"
                    fill="#ff4d1a"
                  />
                </svg>
              </motion.div>
              <p className="mt-5 flex font-display text-[44px] font-[760] leading-none tracking-[-0.045em]">
                {"bookverse".split("").map((ch, i) => (
                  <motion.span
                    key={i}
                    initial={{ y: 28, opacity: 0, rotateX: -80 }}
                    animate={{ y: 0, opacity: 1, rotateX: 0 }}
                    transition={{ delay: (calm ? 0 : 0.12) + i * 0.035, duration: 0.5, ease }}
                  >
                    {ch}
                  </motion.span>
                ))}
              </p>
              <motion.p
                className="mt-3 text-center text-[15px] font-medium text-[#f4f3ef]/75"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: calm ? 0.1 : 0.5, duration: 0.5, ease }}
              >
                Ler, ouvir e descobrir. <span className="text-[#ff7a4f]">De graça.</span>
              </motion.p>
            </div>
          )}

          {/* Skip */}
          {!calm && stage < 5 && (
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skip();
              }}
              className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white/85 backdrop-blur"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Pular
            </motion.button>
          )}
        </>
      )}
    </motion.div>
  );
}
