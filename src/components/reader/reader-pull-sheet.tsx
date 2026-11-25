import { AnimatePresence, motion, useDragControls } from "motion/react";
import { ArrowUp, Headphones, List, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LumiFace } from "@/components/brand/lumi";
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
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [hint, setHint] = useState(false);
  const drag = useDragControls();
  const start = useRef<{ y: number; id: number } | null>(null);

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

  function openSheet() {
    dismissHint();
    setOpen(true);
  }

  const turn: TurnStyle | "rolagem" =
    settings.mode === "scroll"
      ? "rolagem"
      : (settings.turnStyle ?? (settings.pageTurn === false ? "instantaneo" : "folha"));

  const ask = (a: PullSheetAsk) => {
    setOpen(false);
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
            className="absolute bottom-[calc(max(1.1rem,env(safe-area-inset-bottom))+2.1rem)] left-1/2 z-[25] -translate-x-1/2 lg:bottom-[3.4rem]"
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
              onClick={openSheet}
              onPointerDown={(e) => {
                start.current = { y: e.clientY, id: e.pointerId };
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                const s = start.current;
                if (s && s.id === e.pointerId && s.y - e.clientY > 14) {
                  start.current = null;
                  openSheet();
                }
              }}
              onPointerUp={() => (start.current = null)}
              onPointerCancel={() => (start.current = null)}
              className="group grid h-7 w-[72px] touch-none place-items-center"
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

      {/* Sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              data-reader-action="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/35"
              onClick={() => setOpen(false)}
            />
            <motion.div
              data-reader-action="true"
              role="dialog"
              aria-label="Lumi e ajustes de leitura"
              drag="y"
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.8 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 500) setOpen(false);
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              className="fixed inset-x-0 bottom-0 z-[56] mx-auto flex max-h-[min(88dvh,720px)] w-full max-w-[560px] flex-col rounded-t-[30px]"
              style={{
                background: chrome.card,
                color: chrome.ink,
                fontFamily: "var(--font-sans)",
                boxShadow: `0 -20px 60px -20px rgba(0,0,0,.4), inset 0 1px 0 ${chrome.line}`,
              }}
            >
              <div
                className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
                onPointerDown={(e) => drag.start(e)}
              >
                <span className="h-[5px] w-10 rounded-full" style={{ background: chrome.line }} />
              </div>

              <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {/* Lumi */}
                <div className="rounded-[22px] p-3" style={{ background: chrome.lilac }}>
                  <div className="flex items-center gap-2.5">
                    <LumiFace size={30} />
                    <p className="text-[14.5px] font-bold">Lumi está lendo com você</p>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (text.trim()) ask({ free: text.trim() });
                    }}
                    className="mt-2.5 flex items-center gap-2 rounded-full py-1 pl-4 pr-1"
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
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {QUICK.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => ask(q.id)}
                        className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-transform active:scale-95"
                        style={{ background: chrome.card, color: chrome.ink }}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turn style */}
                <p
                  className="mb-2 mt-4 px-1 text-[12px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: chrome.muted }}
                >
                  Como virar a página
                </p>
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
                        className="h-10 min-w-0 truncate rounded-[13px] px-1 text-[12.5px] font-bold transition-colors"
                        style={{
                          background: on ? accent : chrome.surface2,
                          color: on ? "#fff" : chrome.ink,
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Size + theme */}
                <div className="mt-4 flex items-center gap-3">
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
                  <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
                    {THEMES.map((t) => {
                      const on = settings.theme === t.value;
                      return (
                        <button
                          key={t.value}
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
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shortcuts */}
                <div className="mt-4 grid grid-cols-3 gap-2">
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
                        setOpen(false);
                        fn();
                      }}
                      className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] text-[13px] font-semibold"
                      style={{ background: chrome.surface2 }}
                    >
                      <Icon className="h-[18px] w-[18px]" /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
