import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  BookOpenText,
  ChevronRight,
  CloudRain,
  Flame,
  Focus,
  Headphones,
  MoonStar,
  Sun,
  Volume2,
  Waves,
  X,
  Zap,
} from "lucide-react";

import type {
  AmbientSound,
  FooterInfo,
  ReaderFont,
  ReaderSettings,
  ReaderTheme,
  TapZones,
  TurnStyle,
} from "@/lib/reader-store";
import { resolveTurnStyle } from "@/lib/reader-store";
import { setAmbient } from "@/lib/ambient-sound";

/** Matches the shape of THEME_STYLES[settings.theme] in reader.$bookId.tsx. */
export interface ReaderThemeColors {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  rule: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
  theme: ReaderThemeColors;
  /** Opens straight on the "Páginas" tab. */
  initialTab?: Tab;
}

export const READER_THEMES: { value: ReaderTheme; label: string; bg: string; fg: string }[] = [
  { value: "light", label: "Branco", bg: "#FFFFFF", fg: "#1B1B1B" },
  { value: "paper", label: "Papel", bg: "#F7F3EA", fg: "#2A2620" },
  { value: "sepia", label: "Sépia", bg: "#F5ECD9", fg: "#3B2F22" },
  { value: "gray", label: "Cinza", bg: "#3A3A3D", fg: "#E8E6E1" },
  { value: "dark", label: "Noite", bg: "#111113", fg: "#D9D6CF" },
];

export const READER_FONTS: { value: ReaderFont; label: string; family: string; hint: string }[] = [
  {
    value: "literata",
    label: "Literata",
    family: '"Literata Variable", Georgia, serif',
    hint: "Feita para telas",
  },
  {
    value: "sans",
    label: "Grotesca",
    family: '"Bricolage Grotesque Variable", system-ui, sans-serif',
    hint: "Moderna",
  },
  {
    value: "serif",
    label: "Clássica",
    family: '"Newsreader Variable", Georgia, serif',
    hint: "Livro impresso",
  },
  {
    value: "atkinson",
    label: "Legível+",
    family: '"Atkinson Hyperlegible", system-ui, sans-serif',
    hint: "Baixa visão",
  },
];

const TURNS: { value: TurnStyle | "rolagem"; label: string; hint: string }[] = [
  { value: "folha", label: "Folha", hint: "Folha: dobra de papel realista que segue o seu dedo" },
  { value: "deslizar", label: "Deslizar", hint: "Deslizar: a próxima página entra por cima" },
  { value: "esmaecer", label: "Esmaecer", hint: "Esmaecer: troca suave e rápida" },
  {
    value: "instantaneo",
    label: "Instantâneo",
    hint: "Instantâneo: sem animação, como um e-reader",
  },
  { value: "rolagem", label: "Rolagem", hint: "Rolagem: o texto corre de cima a baixo" },
];

const FOOTERS: { value: FooterInfo; label: string }[] = [
  { value: "pagina", label: "Página" },
  { value: "capitulo", label: "Tempo no capítulo" },
  { value: "livro", label: "Tempo no livro" },
  { value: "percent", label: "Porcentagem" },
  { value: "nada", label: "Nada" },
];

const SOUNDS: { value: AmbientSound; label: string; icon: typeof CloudRain }[] = [
  { value: "off", label: "Silêncio", icon: Volume2 },
  { value: "chuva", label: "Chuva", icon: CloudRain },
  { value: "lareira", label: "Lareira", icon: Flame },
  { value: "mar", label: "Mar", icon: Waves },
  { value: "foco", label: "Foco", icon: Headphones },
];

type Tab = "aparencia" | "paginas";

function isDark(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/** Mini page that previews each page-turn style. */
function TurnIcon({ kind, on }: { kind: TurnStyle | "rolagem"; on: boolean }) {
  const line = (y: number, w: number) => (
    <rect key={y} x="12" y={y} width={w} height="2.5" rx="1.2" fill="#c9c5bb" />
  );
  const lines = [14, 20, 26, 32, 38, 44].map((y) => line(y, y % 12 ? 32 : 26));
  return (
    <svg width="50" height="59" viewBox="0 0 56 66" aria-hidden>
      <rect x="6" y="4" width="44" height="58" rx="5" fill="#fff" stroke="#d9d6ce" />
      {lines}
      {kind === "folha" && (
        <>
          <path d="M50 40 L50 62 L30 62 Q40 52 50 40Z" fill="#ece6d8" stroke="#d1cbbd" />
          <path d="M30 62 Q40 52 50 40" stroke="#bdb6a6" fill="none" />
        </>
      )}
      {kind === "deslizar" && (
        <>
          <rect
            x="22"
            y="4"
            width="34"
            height="58"
            rx="5"
            fill="#fff"
            stroke="#d9d6ce"
            style={{ filter: "drop-shadow(-3px 0 3px rgba(0,0,0,.15))" }}
          />
          <path
            d="M16 33h-8m0 0l4-4m-4 4l4 4"
            stroke={on ? "#ff4d1a" : "#9a9993"}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === "esmaecer" && (
        <rect x="6" y="4" width="44" height="58" rx="5" fill="#fff" opacity=".6" />
      )}
      {kind === "instantaneo" && (
        <rect x="6" y="4" width="44" height="58" rx="5" fill="#141416" opacity=".85" />
      )}
      {kind === "rolagem" && (
        <path
          d="M28 10v46m0 0l-5-5m5 5l5-5"
          stroke={on ? "#ff4d1a" : "#9a9993"}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/**
 * "Aparência" — a bottom sheet on phones, a side sheet on larger screens,
 * with two tabs: how the page looks and how pages turn.
 */
export function ReaderSettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  theme,
  initialTab = "aparencia",
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const dark = isDark(theme.bg);
  const c = dark
    ? {
        surface: "#1c1c1f",
        surface2: "#2a2a2f",
        ink: "#f3f2ee",
        muted: "#a8a7a1",
        line: "#33333a",
        accentSoft: "#3a1d13",
      }
    : {
        surface: "#ffffff",
        surface2: "#ecebe6",
        ink: "#131313",
        muted: "#5c5b56",
        line: "#e4e2dc",
        accentSoft: "#ffe7dd",
      };
  const accent = "#ff4d1a";
  const turn: TurnStyle | "rolagem" =
    settings.mode === "scroll" ? "rolagem" : resolveTurnStyle(settings);
  const theTheme = settings.theme === "amoled" ? "dark" : settings.theme;

  const seg = (options: { v: string; l: string }[], value: string, set: (v: string) => void) => (
    <div className="flex rounded-[14px] p-1" style={{ background: c.surface2 }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => set(o.v)}
            className="relative h-9 flex-1 rounded-[11px] text-[13.5px] font-semibold"
            style={{ color: on ? c.ink : c.muted }}
          >
            {on && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.v).join("")}`}
                className="absolute inset-0 rounded-[11px]"
                style={{ background: c.surface, boxShadow: "0 2px 6px rgba(0,0,0,.08)" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.l}</span>
          </button>
        );
      })}
    </div>
  );

  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => set(!on)}
      className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? "#2fbf71" : c.line }}
    >
      <motion.span
        className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow"
        animate={{ left: on ? 23 : 3 }}
        transition={{ type: "spring", stiffness: 600, damping: 36 }}
      />
    </button>
  );

  const row = (Icon: typeof Sun, title: string, sub: string, control: React.ReactNode) => (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${c.line}` }}>
      <Icon className="h-[19px] w-[19px] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-xs" style={{ color: c.muted }}>
          {sub}
        </p>
      </div>
      {control}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
            onClick={onClose}
            data-reader-action="true"
          />
          <motion.aside
            key="sheet"
            role="dialog"
            aria-label="Aparência do leitor"
            data-reader-action="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className={`fixed inset-x-0 bottom-0 z-[61] mx-auto ${tab === "aparencia" ? "max-h-[64dvh]" : "max-h-[84dvh]"} w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-t-[34px] px-[22px] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2.5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,.35)] sm:bottom-4 sm:rounded-[34px]`}
            style={{ background: c.surface, color: c.ink, fontFamily: "var(--font-sans)" }}
          >
            <div
              className="mx-auto mb-[18px] h-[5px] w-10 rounded-full"
              style={{ background: c.line }}
            />
            <div className="flex items-center justify-between">
              <h2 className="text-[22px]" style={{ fontFamily: "var(--font-display)" }}>
                {tab === "aparencia" ? "Aparência" : "Virar página"}
              </h2>
              {tab === "aparencia" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        theme: "paper",
                        font: "literata",
                        fontSize: 18,
                        lineHeight: 1.62,
                        margin: 32,
                        paragraphSpacing: 0,
                        warmth: 0,
                        dim: 0,
                      })
                    }
                    className="h-8 rounded-full px-3.5 text-[13.5px] font-semibold"
                    style={{ background: c.surface2 }}
                  >
                    Padrão
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="grid h-8 w-8 place-items-center rounded-full"
                    style={{ background: c.surface2 }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1 text-[13px] font-semibold"
                  style={{ color: c.muted }}
                >
                  <button type="button" onClick={() => setTab("aparencia")}>
                    Aparência
                  </button>
                  <span>·</span>
                  <span style={{ color: c.ink }}>Páginas</span>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="ml-2 grid h-8 w-8 place-items-center rounded-full"
                    style={{ background: c.surface2 }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {tab === "aparencia" ? (
              <>
                <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Tema da página">
                  {READER_THEMES.map((t) => {
                    const on = theTheme === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange({ theme: t.value })}
                        className="flex-1 text-center"
                      >
                        <span
                          className="grid h-[62px] place-items-center rounded-[16px] text-[22px]"
                          style={{
                            background: t.bg,
                            color: t.fg,
                            fontFamily: '"Literata Variable", serif',
                            boxShadow: on ? `0 0 0 2.5px ${accent}` : `inset 0 0 0 1px ${c.line}`,
                          }}
                        >
                          Aa
                        </span>
                        <span
                          className="mt-1.5 block text-[11.5px] font-semibold"
                          style={{ color: on ? c.ink : c.muted }}
                        >
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center gap-3.5">
                  <button
                    type="button"
                    aria-label="Diminuir letra"
                    onClick={() => onChange({ fontSize: Math.max(13, settings.fontSize - 1) })}
                    className="text-[15px]"
                    style={{ fontFamily: '"Literata Variable", serif' }}
                  >
                    A
                  </button>
                  <input
                    type="range"
                    min={13}
                    max={32}
                    value={settings.fontSize}
                    onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                    aria-label="Tamanho da letra"
                    className="reader-range flex-1"
                    style={{
                      ["--fill" as string]: `${((settings.fontSize - 13) / 19) * 100}%`,
                      ["--ink" as string]: c.ink,
                      ["--track" as string]: c.surface2,
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Aumentar letra"
                    onClick={() => onChange({ fontSize: Math.min(32, settings.fontSize + 1) })}
                    className="text-2xl"
                    style={{ fontFamily: '"Literata Variable", serif' }}
                  >
                    A
                  </button>
                </div>

                <div className="mt-5 flex gap-2">
                  {READER_FONTS.map((f) => {
                    const on = settings.font === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => onChange({ font: f.value })}
                        title={f.hint}
                        className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[16px]"
                        style={{
                          background: on ? c.ink : c.surface2,
                          color: on ? c.surface : c.ink,
                        }}
                      >
                        <span className="text-[19px] leading-none" style={{ fontFamily: f.family }}>
                          Ag
                        </span>
                        <span className="text-[10.5px] font-semibold opacity-75">{f.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  {seg(
                    [
                      { v: "paginated", l: "Páginas" },
                      { v: "scroll", l: "Rolagem contínua" },
                    ],
                    settings.mode,
                    (v) => onChange({ mode: v as ReaderSettings["mode"] }),
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setTab("paginas")}
                  className="mt-1.5 flex w-full items-center gap-3 py-3 text-left"
                  style={{ borderBottom: `1px solid ${c.line}` }}
                >
                  <BookOpenText className="h-[19px] w-[19px] shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">Virar página</span>
                    <span className="mt-0.5 block text-xs" style={{ color: c.muted }}>
                      {TURNS.find((t) => t.value === turn)?.label} · toques, rodapé e mais
                    </span>
                  </span>
                  <ChevronRight className="h-[18px] w-[18px]" style={{ color: c.muted }} />
                </button>
                <div>
                  {row(
                    MoonStar,
                    "Luz quente à noite",
                    "Reduz o azul depois das 20h",
                    toggle(
                      !!settings.autoWarm,
                      (v) => onChange({ autoWarm: v }),
                      "Luz quente à noite",
                    ),
                  )}
                  {row(
                    Focus,
                    "Modo foco",
                    "Esconde tudo, só o texto",
                    toggle(!!settings.focusMode, (v) => onChange({ focusMode: v }), "Modo foco"),
                  )}
                </div>

                <p
                  className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: c.muted }}
                >
                  Ajuste fino
                </p>
                {[
                  {
                    label: "Entrelinhas",
                    key: "lineHeight" as const,
                    min: 1.3,
                    max: 2.2,
                    step: 0.05,
                    fmt: (v: number) => v.toFixed(2).replace(".", ","),
                  },
                  {
                    label: "Margens",
                    key: "margin" as const,
                    min: 12,
                    max: 72,
                    step: 2,
                    fmt: (v: number) => `${v}px`,
                  },
                  {
                    label: "Brilho",
                    key: "dim" as const,
                    min: 0,
                    max: 70,
                    step: 1,
                    fmt: (v: number) => `${100 - v}%`,
                    invert: true,
                  },
                  {
                    label: "Luz quente",
                    key: "warmth" as const,
                    min: 0,
                    max: 100,
                    step: 1,
                    fmt: (v: number) => `${v}%`,
                  },
                ].map((r) => {
                  const raw = (settings[r.key] as number | undefined) ?? 0;
                  const v = r.invert ? r.max - raw : raw;
                  return (
                    <label
                      key={r.key}
                      className="flex items-center gap-3 py-2 text-[13.5px] font-semibold"
                    >
                      <span className="w-24 shrink-0">{r.label}</span>
                      <input
                        type="range"
                        min={r.min}
                        max={r.max}
                        step={r.step}
                        value={v}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          onChange({
                            [r.key]: r.invert ? r.max - n : n,
                          } as Partial<ReaderSettings>);
                        }}
                        className="reader-range flex-1"
                        style={{
                          ["--fill" as string]: `${((v - r.min) / (r.max - r.min)) * 100}%`,
                          ["--ink" as string]: c.ink,
                          ["--track" as string]: c.surface2,
                        }}
                      />
                      <span
                        className="w-12 text-right text-xs tabular-nums"
                        style={{ color: c.muted }}
                      >
                        {r.fmt(raw)}
                      </span>
                    </label>
                  );
                })}

                <p
                  className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: c.muted }}
                >
                  Som ambiente
                </p>
                <div className="flex gap-2">
                  {SOUNDS.map((sd) => {
                    const on = (settings.ambient ?? "off") === sd.value;
                    const Icon = sd.icon;
                    return (
                      <button
                        key={sd.value}
                        type="button"
                        onClick={() => {
                          onChange({ ambient: sd.value });
                          setAmbient(sd.value, settings.ambientVolume ?? 0.35);
                        }}
                        className="flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[16px] text-[10.5px] font-semibold"
                        style={{
                          background: on ? c.ink : c.surface2,
                          color: on ? c.surface : c.ink,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        {sd.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div
                  className="mt-4 flex gap-1.5"
                  role="radiogroup"
                  aria-label="Estilo de virar página"
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
                        className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[16px] px-0.5 pb-2 pt-2.5"
                        style={{
                          background: on ? c.accentSoft : c.surface2,
                          boxShadow: on ? `inset 0 0 0 2px ${accent}` : "none",
                        }}
                      >
                        <TurnIcon kind={t.value} on={on} />
                        <span className="max-w-full truncate text-[11px] font-bold">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2.5 text-center text-[12.5px]" style={{ color: c.muted }}>
                  {TURNS.find((t) => t.value === turn)?.hint}
                </p>

                <p
                  className="mb-2.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: c.muted }}
                >
                  Toques e gestos
                </p>
                {seg(
                  [
                    { v: "padrao", l: "Padrão" },
                    { v: "canhoto", l: "Canhoto" },
                    { v: "deslizar", l: "Só deslizar" },
                  ],
                  settings.tapZones ?? "padrao",
                  (v) => onChange({ tapZones: v as TapZones }),
                )}

                <p
                  className="mb-2.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: c.muted }}
                >
                  No rodapé — toque para alternar
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FOOTERS.map((f) => {
                    const on = (settings.footer ?? "capitulo") === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => onChange({ footer: f.value })}
                        className="h-8 rounded-full px-3.5 text-[12.5px] font-semibold"
                        style={
                          on
                            ? { background: c.ink, color: c.surface }
                            : {
                                background: c.surface,
                                color: c.ink,
                                boxShadow: `inset 0 0 0 1px ${c.line}`,
                              }
                        }
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2">
                  {row(
                    BookOpenText,
                    "Duas páginas na horizontal",
                    "Tablet e computador",
                    toggle(
                      settings.twoPage !== false,
                      (v) => onChange({ twoPage: v }),
                      "Duas páginas",
                    ),
                  )}
                  {row(
                    Zap,
                    "Atualizar tela a cada 6 páginas",
                    "Para leitores e-ink",
                    toggle(
                      !!settings.einkRefresh,
                      (v) => onChange({ einkRefresh: v }),
                      "Atualização e-ink",
                    ),
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
