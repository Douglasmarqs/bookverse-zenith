import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react";
import { ArrowUp, Headphones, List, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Lumi, LumiFace } from "@/components/brand/lumi";
import type { ReaderSettings, ReaderTheme, TurnStyle } from "@/lib/reader-store";

type Chrome = {
  card: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  lilac: string;
};

const TURNS: { value: TurnStyle | "rolagem"; label: string }[] = [
  { value: "folha", label: "Folha" },
  { value: "deslizar", label: "Deslizar" },
  { value: "esmaecer", label: "Esmaecer" },
  { value: "instantaneo", label: "Direto" },
  { value: "rolagem", label: "Rolagem" },
];

const THEMES: { value: ReaderTheme; bg: string; fg: string; label: string }[] = [
  { value: "light", bg: "#FFFFFF", fg: "#1B1B1B", label: "Branco" },
  { value: "paper", bg: "#F7F3EA", fg: "#2A2620", label: "Papel" },
  { value: "sepia", bg: "#F5ECD9", fg: "#3B2F22", label: "Sépia" },
  { value: "gray", bg: "#3A3A3D", fg: "#E8E6E1", label: "Cinza" },
  { value: "dark", bg: "#111113", fg: "#D9D6CF", label: "Escuro" },
  { value: "amoled", bg: "#000000", fg: "#E6E3DC", label: "Preto" },
];

export type PullSheetAsk = "resumo" | "pagina" | "personagens" | "palavras" | { free: string };

const QUICK: { id: Exclude<PullSheetAsk, { free: string }>; label: string }[] = [
  { id: "resumo", label: "Resumir o capítulo até aqui" },
  { id: "pagina", label: "Explicar esta página" },
  { id: "personagens", label: "Quem é quem (sem spoilers)" },
  { id: "palavras", label: "Palavras difíceis daqui" },
];

const HINT_KEY = "bookverse:reader:pull-hint-seen";

/* The sheet's sections arrive one after another as it rises. */
const LIST: Variants = {
  hidden: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.06 } },
};
const ITEM: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 30 },
  },
};
const CHIPS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.12 } },
};
const CHIP: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 520, damping: 28 } },
};

/**
 * A grab handle at the bottom of the page. Pull it up (or tap it) for a
 * quick sheet: ask Lumi about what you're reading, switch how pages turn,
 * and adjust size/theme without leaving the page.
 */
export function ReaderPullSheet({
  hidden,
  hintBlocked = false,
  chrome,
  pageMuted,
  accent,
  settings,
  onChange,
  onAsk,
  onToc,
  onListen,
  onMore,
}: {
  /** Hide the handle (controls card or another panel is up). */
  hidden: boolean;
  /** Another first-run tip is on screen; ours waits for it. */
  hintBlocked?: boolean;
  chrome: Chrome;
  pageMuted: string;
  accent: string;
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
  onAsk: (ask: PullSheetAsk) => void;
  onToc: () => void;
  onListen: () => void;
  onMore: () => void;
}) {
  /** Mounted (pulling, open or closing). */
  const [open, setOpen] = useState(false);
  /** Content has cascaded in (past ~a third of the pull). */
  const [shown, setShown] = useState(false);
  /** Pulled far enough that letting go opens it — Lumi cheers. */
  const [armed, setArmed] = useState(false);
  /** Fully open and resting. */
  const [settled, setSettled] = useState(false);
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [hint, setHint] = useState(false);

  // The sheet's position is one number that follows the finger: 0 = open,
  // its height = hidden below the screen.
  const y = useMotionValue(2000);
  const sheetRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(620);
  const pull = useRef<{
    from: "handle" | "sheet";
    startY: number;
    lastY: number;
    lastT: number;
    v: number;
    moved: boolean;
  } | null>(null);
  const progress = useTransform(y, (v) =>
    Math.max(0, Math.min(1, 1 - v / Math.max(1, heightRef.current))),
  );
  const lumiY = useTransform(progress, [0, 1], [46, 0]);
  const lumiScale = useTransform(progress, [0, 0.55, 1], [0.35, 1.15, 1]);
  const lumiRotate = useTransform(progress, [0, 1], [-30, 0]);
  const sheetScale = useTransform(progress, [0, 1], [0.94, 1]);
  useMotionValueEvent(progress, "change", (p) => {
    if (p > 0.32 && !shown) setShown(true);
    const isArmed = p > 0.3;
    if (pull.current?.from === "handle" && isArmed !== armed) {
      setArmed(isArmed);
      if (isArmed) navigator.vibrate?.(8);
    }
  });

  useEffect(() => {
    if (hintBlocked || hidden) return;
    try {
      if (!localStorage.getItem(HINT_KEY)) {
        const t = setTimeout(() => setHint(true), 2500);
        return () => clearTimeout(t);
      }
    } catch {
      /* private mode: no hint */
    }
  }, [hintBlocked, hidden]);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => dismissHint(), 6000);
    return () => clearTimeout(t);
  }, [hint]);
  function dismissHint() {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function settleOpen(velocity = 0) {
    setShown(true);
    setArmed(false);
    void animate(
      y,
      0,
      reduce
        ? { duration: 0.15 }
        : { type: "spring", stiffness: 330, damping: 30, mass: 0.9, velocity },
    ).then(() => setSettled(true));
  }
  function close(velocity = 0) {
    setSettled(false);
    setShown(false);
    setArmed(false);
    void animate(
      y,
      heightRef.current + 40,
      reduce
        ? { duration: 0.12 }
        : { type: "spring", stiffness: 420, damping: 40, velocity, restDelta: 2 },
    ).then(() => setOpen(false));
  }

  // Measure once mounted; start just below the screen (or where the finger is).
  useLayoutEffect(() => {
    if (!open || !sheetRef.current) return;
    heightRef.current = sheetRef.current.offsetHeight;
    const g = pull.current;
    if (g?.from === "handle") y.set(Math.max(0, heightRef.current - (g.startY - g.lastY)));
    else {
      y.set(heightRef.current);
      settleOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Finger tracking shared by the handle (pull up) and the grabber (pull down). */
  function track(from: "handle" | "sheet", e: React.PointerEvent) {
    const now = performance.now();
    pull.current = { from, startY: e.clientY, lastY: e.clientY, lastT: now, v: 0, moved: false };
    const H = () => heightRef.current;
    const move = (ev: PointerEvent) => {
      const g = pull.current;
      if (!g) return;
      const t = performance.now();
      g.v = (ev.clientY - g.lastY) / Math.max(1, t - g.lastT); // px/ms, + = down
      g.lastY = ev.clientY;
      g.lastT = t;
      const dy = ev.clientY - g.startY;
      if (Math.abs(dy) > 6) g.moved = true;
      // Handle: the sheet rises with the finger. Sheet: it follows down.
      const base = g.from === "handle" ? H() + dy : dy;
      // Past the top it resists like a rubber band.
      y.set(base >= 0 ? base : -Math.sqrt(-base) * 2.2);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const g = pull.current;
      pull.current = null;
      if (!g) return;
      const vel = g.v * 1000; // px/s
      if (g.from === "handle") {
        const pulled = (H() - y.get()) / H();
        if (!g.moved || pulled > 0.28 || g.v < -0.45) settleOpen(vel);
        else close(vel);
      } else {
        if (y.get() > 110 || g.v > 0.5) close(vel);
        else settleOpen(vel);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  const turn: TurnStyle | "rolagem" =
    settings.mode === "scroll"
      ? "rolagem"
      : (settings.turnStyle ?? (settings.pageTurn === false ? "instantaneo" : "folha"));

  const ask = (a: PullSheetAsk) => {
    close();
    setText("");
    onAsk(a);
  };

  return (
    <>
      {/* Handle */}
      <AnimatePresence>
        {!hidden && !open && (
          <motion.div
            data-reader-action="true"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-[calc(max(1.1rem,env(safe-area-inset-bottom))+1.85rem)] left-1/2 z-[25] -translate-x-1/2 lg:bottom-[3.4rem]"
          >
            <AnimatePresence>
              {hint && !hintBlocked && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-lg"
                  style={{
                    background: chrome.ink,
                    color: chrome.card,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Puxe para cima: Lumi e ajustes
                </motion.p>
              )}
            </AnimatePresence>
            <button
              type="button"
              aria-label="Abrir Lumi e ajustes de leitura"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                dismissHint();
                track("handle", e);
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
              className="group grid h-9 w-[96px] touch-none place-items-center"
            >
              <motion.span
                animate={hint ? { y: [0, -4, 0] } : { y: 0 }}
                transition={hint ? { repeat: Infinity, duration: 1.2 } : undefined}
                className="block h-[5px] w-10 rounded-full opacity-45 transition-opacity group-hover:opacity-80"
                style={{ background: pageMuted }}
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet — follows the finger, springs open or away on release. */}
      {open && (
        <>
          <motion.div
            data-reader-action="true"
            className="fixed inset-0 z-[55] bg-black/40"
            style={{ opacity: progress }}
            onClick={() => close()}
          />
          <motion.div
            ref={sheetRef}
            data-reader-action="true"
            role="dialog"
            aria-label="Lumi e ajustes de leitura"
            style={{
              y,
              scaleX: sheetScale,
              background: chrome.card,
              color: chrome.ink,
              fontFamily: "var(--font-sans)",
              boxShadow: `0 -20px 60px -20px rgba(0,0,0,.4), inset 0 1px 0 ${chrome.line}`,
            }}
            className="fixed inset-x-0 bottom-0 z-[56] mx-auto flex max-h-[min(88dvh,720px)] w-full max-w-[560px] origin-bottom flex-col rounded-t-[30px] will-change-transform"
          >
            {/* Lumi peeks over the edge while you pull, and cheers when
                letting go would open it. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-[54px] right-7"
              style={{ y: lumiY, scale: lumiScale, rotate: lumiRotate, originY: 1 }}
            >
              <motion.div
                animate={armed || settled ? { y: [0, -7, 0] } : { y: 0 }}
                transition={
                  armed || settled
                    ? {
                        duration: 0.5,
                        ease: "easeOut",
                        repeat: settled ? 0 : Infinity,
                        repeatDelay: 0.25,
                      }
                    : { duration: 0.2 }
                }
              >
                <Lumi pose={armed || settled ? "hello" : "idle"} size={64} shadow={false} />
              </motion.div>
            </motion.div>
            <AnimatePresence>
              {settled && !reduce && (
                <motion.p
                  initial={{ opacity: 0, scale: 0.6, x: 10, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.9], x: 0, y: 0 }}
                  transition={{ duration: 2.6, times: [0, 0.12, 0.85, 1] }}
                  className="pointer-events-none absolute -top-[46px] right-[96px] rounded-[14px] rounded-br-[4px] px-3 py-1.5 text-[12px] font-bold shadow-lg"
                  style={{ background: chrome.ink, color: chrome.card }}
                >
                  Oi! Pergunte o que quiser 📖
                </motion.p>
              )}
            </AnimatePresence>

            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-1.5 pt-3 active:cursor-grabbing"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                track("sheet", e);
              }}
            >
              <span className="h-[5px] w-10 rounded-full" style={{ background: chrome.line }} />
            </div>

            <motion.div
              variants={LIST}
              initial={reduce ? false : "hidden"}
              animate={shown || reduce ? "show" : "hidden"}
              className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              {/* Lumi */}
              <motion.div
                variants={ITEM}
                className="relative overflow-hidden rounded-[22px] p-3"
                style={{ background: chrome.lilac }}
              >
                {!reduce && (
                  <motion.span
                    aria-hidden
                    initial={{ x: "-120%" }}
                    animate={{ x: "220%" }}
                    transition={{ duration: 1.1, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)",
                    }}
                  />
                )}
                <div className="relative flex items-center gap-2.5">
                  <motion.span
                    initial={reduce ? false : { scale: 0.4, rotate: -25 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 12, delay: 0.15 }}
                    className="inline-flex"
                  >
                    <LumiFace size={30} />
                  </motion.span>
                  <p className="text-[14.5px] font-bold">Lumi está lendo com você</p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (text.trim()) ask({ free: text.trim() });
                  }}
                  className="relative mt-2.5 flex items-center gap-2 rounded-full py-1 pl-4 pr-1"
                  style={{ background: chrome.card }}
                >
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Pergunte sobre o que está lendo…"
                    enterKeyHint="send"
                    className="min-w-0 flex-1 bg-transparent py-2 text-[14.5px] outline-none"
                    style={{ color: chrome.ink }}
                  />
                  <button
                    type="submit"
                    aria-label="Enviar à Lumi"
                    disabled={!text.trim()}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-opacity disabled:opacity-40"
                    style={{ background: accent }}
                  >
                    <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </button>
                </form>
                <motion.div variants={CHIPS} className="relative mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <motion.button
                      key={q.id}
                      variants={CHIP}
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => ask(q.id)}
                      className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
                      style={{ background: chrome.card, color: chrome.ink }}
                    >
                      {q.label}
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>

              {/* Turn style */}
              <motion.div variants={ITEM}>
                <p
                  className="mb-2 mt-4 px-1 text-[12px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: chrome.muted }}
                >
                  Como virar a página
                </p>
                <LayoutGroup id="turn-style">
                  <div
                    className="grid grid-cols-[repeat(auto-fit,minmax(68px,1fr))] gap-1.5"
                    role="radiogroup"
                    aria-label="Como virar a página"
                  >
                    {TURNS.map((t) => {
                      const on = turn === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() =>
                            t.value === "rolagem"
                              ? onChange({ mode: "scroll" })
                              : onChange({
                                  mode: "paginated",
                                  turnStyle: t.value,
                                  pageTurn: t.value !== "instantaneo",
                                })
                          }
                          className="relative h-10 min-w-0 truncate rounded-[13px] px-1 text-[12.5px] font-bold transition-colors duration-200"
                          style={{
                            background: chrome.surface2,
                            color: on ? "#fff" : chrome.ink,
                          }}
                        >
                          {on && (
                            <motion.span
                              layoutId="turn-on"
                              transition={{ type: "spring", stiffness: 520, damping: 34 }}
                              className="absolute inset-0 rounded-[13px]"
                              style={{ background: accent }}
                            />
                          )}
                          <span className="relative">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </motion.div>

              {/* Size + theme */}
              <motion.div variants={ITEM} className="mt-4 flex items-center gap-3">
                <div
                  className="flex h-11 shrink-0 items-center rounded-full"
                  style={{ background: chrome.surface2 }}
                >
                  <button
                    type="button"
                    aria-label="Diminuir letra"
                    onClick={() => onChange({ fontSize: Math.max(13, settings.fontSize - 1) })}
                    className="grid h-11 w-11 place-items-center"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-[13px] font-bold tabular-nums">
                    {settings.fontSize}
                  </span>
                  <button
                    type="button"
                    aria-label="Aumentar letra"
                    onClick={() => onChange({ fontSize: Math.min(32, settings.fontSize + 1) })}
                    className="grid h-11 w-11 place-items-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="no-scrollbar -my-1.5 flex min-w-0 flex-1 gap-2.5 overflow-x-auto px-1.5 py-2.5">
                  {THEMES.map((t) => {
                    const on = settings.theme === t.value;
                    return (
                      <motion.button
                        key={t.value}
                        whileTap={{ scale: 0.86 }}
                        type="button"
                        aria-label={`Tema ${t.label}`}
                        aria-pressed={on}
                        onClick={() => onChange({ theme: t.value })}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold"
                        style={{
                          background: t.bg,
                          color: t.fg,
                          boxShadow: on
                            ? `0 0 0 2px ${chrome.card}, 0 0 0 4px ${accent}`
                            : `inset 0 0 0 1px ${chrome.line}`,
                        }}
                      >
                        Aa
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Shortcuts */}
              <motion.div variants={ITEM} className="mt-4 grid grid-cols-3 gap-2">
                {(
                  [
                    [List, "Sumário", onToc],
                    [Headphones, "Ouvir", onListen],
                    [SlidersHorizontal, "Ajustes", onMore],
                  ] as const
                ).map(([Icon, label, fn]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      close();
                      fn();
                    }}
                    className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] text-[13px] font-semibold"
                    style={{ background: chrome.surface2 }}
                  >
                    <Icon className="h-[18px] w-[18px]" /> {label}
                  </button>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        </>
      )}
    </>
  );
}
