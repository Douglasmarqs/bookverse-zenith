import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  AlignJustify,
  AlignLeft,
  CloudRain,
  Columns2,
  Flame,
  Headphones,
  Minus,
  Plus,
  RotateCcw,
  Rows3,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import type {
  AmbientSound,
  ReaderAlignment,
  ReaderFont,
  ReaderMode,
  ReaderSettings,
  ReaderTheme,
} from "@/lib/reader-store";
import { DEFAULT_SETTINGS } from "@/lib/reader-store";
import { setAmbient } from "@/lib/ambient-sound";

/** Matches the shape of THEME_STYLES[settings.theme] in reader.$bookId.tsx —
 * kept as a separate type here to avoid a route -> component import cycle. */
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
}

const THEME_SWATCHES: { value: ReaderTheme; label: string; bg: string; fg: string }[] = [
  { value: "light", label: "Claro", bg: "#FFFFFF", fg: "#1A1A1A" },
  { value: "paper", label: "Papel", bg: "#F3EAD8", fg: "#2A241B" },
  { value: "sepia", label: "Sépia", bg: "#E8D6B1", fg: "#3A2818" },
  { value: "dark", label: "Noite", bg: "#1A1712", fg: "#E8DFD3" },
  { value: "amoled", label: "AMOLED", bg: "#000000", fg: "#F2F0EA" },
];

export const READER_FONTS: { value: ReaderFont; label: string; family: string; hint: string }[] = [
  { value: "serif", label: "Newsreader", family: "var(--font-book)", hint: "Clássica" },
  {
    value: "literata",
    label: "Literata",
    family: '"Literata Variable", Georgia, serif',
    hint: "Feita para telas",
  },
  {
    value: "atkinson",
    label: "Atkinson",
    family: '"Atkinson Hyperlegible", system-ui, sans-serif',
    hint: "Máxima legibilidade",
  },
  { value: "sans", label: "Sem serifa", family: "var(--font-sans)", hint: "Moderna" },
];

const SOUNDS: { value: AmbientSound; label: string; icon: typeof CloudRain }[] = [
  { value: "off", label: "Silêncio", icon: Volume2 },
  { value: "chuva", label: "Chuva", icon: CloudRain },
  { value: "lareira", label: "Lareira", icon: Flame },
  { value: "mar", label: "Mar", icon: Waves },
  { value: "foco", label: "Foco", icon: Headphones },
];

type Tab = "texto" | "pagina" | "luz";

/**
 * Styled entirely from the `theme` prop (not site tokens) so it always
 * matches the page behind it. A bottom sheet on phones, a side sheet on
 * larger screens.
 */
export function ReaderSettingsPanel({ open, onClose, settings, onChange, theme }: Props) {
  const [tab, setTab] = useState<Tab>("texto");
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            role="dialog"
            aria-label="Ajustes de leitura"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[1.75rem] shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:max-h-none sm:w-[24rem] sm:rounded-[1.75rem]"
            style={{
              backgroundColor: theme.bg,
              color: theme.fg,
              border: `1px solid ${theme.rule}`,
              fontFamily: "var(--font-sans)",
            }}
          >
            <div
              className="mx-auto mt-2.5 h-1 w-10 rounded-full sm:hidden"
              style={{ background: theme.rule }}
            />
            <header className="flex items-center justify-between px-5 pb-3 pt-3">
              <h3 className="font-display text-3xl">Aparência</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    onChange({
                      font: DEFAULT_SETTINGS.font,
                      fontSize: DEFAULT_SETTINGS.fontSize,
                      lineHeight: DEFAULT_SETTINGS.lineHeight,
                      paragraphSpacing: DEFAULT_SETTINGS.paragraphSpacing,
                      margin: DEFAULT_SETTINGS.margin,
                      maxWidth: DEFAULT_SETTINGS.maxWidth,
                      alignment: DEFAULT_SETTINGS.alignment,
                      warmth: 0,
                      dim: 0,
                    })
                  }
                  className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-70"
                  aria-label="Restaurar padrão"
                  title="Restaurar padrão"
                  style={{ color: theme.muted }}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* theme swatches always visible */}
            <div className="grid grid-cols-5 gap-2 px-5">
              {THEME_SWATCHES.map((t) => {
                const active = settings.theme === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => onChange({ theme: t.value })}
                    aria-pressed={active}
                    className="relative flex flex-col items-center gap-1.5 text-[11px]"
                  >
                    <span
                      className="grid h-12 w-full place-items-center rounded-2xl font-display text-xl transition-transform active:scale-95"
                      style={{
                        background: t.bg,
                        color: t.fg,
                        boxShadow: `inset 0 0 0 1px ${theme.rule}`,
                      }}
                    >
                      Aa
                    </span>
                    {active && (
                      <motion.span
                        layoutId="reader-theme-ring"
                        className="absolute inset-x-0 top-0 h-12 rounded-2xl"
                        style={{ boxShadow: `0 0 0 2px ${theme.accent}` }}
                      />
                    )}
                    <span style={{ color: active ? theme.accent : theme.muted }}>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div
              role="tablist"
              className="mx-5 mt-4 grid grid-cols-3 rounded-full p-1"
              style={{ background: theme.rule }}
            >
              {(
                [
                  ["texto", "Texto"],
                  ["pagina", "Página"],
                  ["luz", "Luz e som"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className="relative rounded-full py-2 text-xs font-semibold"
                >
                  {tab === id && (
                    <motion.span
                      layoutId="reader-tab"
                      className="absolute inset-0 rounded-full"
                      style={{ background: theme.bg }}
                      transition={{ type: "spring", stiffness: 450, damping: 34 }}
                    />
                  )}
                  <span className="relative" style={{ color: tab === id ? theme.fg : theme.muted }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5">
              {tab === "texto" && (
                <>
                  <Group label="Fonte" theme={theme}>
                    <div className="grid grid-cols-2 gap-2">
                      {READER_FONTS.map((f) => {
                        const active = (settings.font ?? "serif") === f.value;
                        return (
                          <button
                            key={f.value}
                            onClick={() => onChange({ font: f.value })}
                            aria-pressed={active}
                            className="rounded-2xl p-3 text-left transition active:scale-[0.98]"
                            style={{
                              boxShadow: `inset 0 0 0 ${active ? 2 : 1}px ${active ? theme.accent : theme.rule}`,
                            }}
                          >
                            <span className="block text-xl" style={{ fontFamily: f.family }}>
                              {f.label}
                            </span>
                            <span className="text-[11px]" style={{ color: theme.muted }}>
                              {f.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Group>
                  <Stepper
                    theme={theme}
                    label="Tamanho"
                    value={settings.fontSize}
                    min={13}
                    max={34}
                    step={1}
                    display={`${settings.fontSize}px`}
                    onChange={(v) => onChange({ fontSize: v })}
                    big
                  />
                  <Slider
                    theme={theme}
                    label="Entrelinha"
                    value={settings.lineHeight}
                    min={1.3}
                    max={2.3}
                    step={0.05}
                    display={settings.lineHeight.toFixed(2).replace(".", ",")}
                    onChange={(v) => onChange({ lineHeight: v })}
                  />
                  <Slider
                    theme={theme}
                    label="Espaço entre parágrafos"
                    value={settings.paragraphSpacing}
                    min={0}
                    max={2}
                    step={0.05}
                    display={`${settings.paragraphSpacing.toFixed(1).replace(".", ",")} em`}
                    onChange={(v) => onChange({ paragraphSpacing: v })}
                  />
                  <Group label="Alinhamento" theme={theme}>
                    <SegGroup<ReaderAlignment>
                      theme={theme}
                      value={settings.alignment}
                      onChange={(v) => onChange({ alignment: v })}
                      options={[
                        {
                          value: "justify",
                          label: "Justificado",
                          icon: <AlignJustify className="h-3.5 w-3.5" />,
                        },
                        {
                          value: "left",
                          label: "À esquerda",
                          icon: <AlignLeft className="h-3.5 w-3.5" />,
                        },
                      ]}
                    />
                  </Group>
                </>
              )}

              {tab === "pagina" && (
                <>
                  <Group label="Modo de leitura" theme={theme}>
                    <SegGroup<ReaderMode>
                      theme={theme}
                      value={settings.mode}
                      onChange={(v) => onChange({ mode: v })}
                      options={[
                        {
                          value: "paginated",
                          label: "Páginas",
                          icon: <Columns2 className="h-3.5 w-3.5" />,
                        },
                        {
                          value: "scroll",
                          label: "Rolagem",
                          icon: <Rows3 className="h-3.5 w-3.5" />,
                        },
                      ]}
                    />
                  </Group>
                  {settings.mode === "paginated" && (
                    <Toggle
                      theme={theme}
                      label="Efeito de folha"
                      hint="A página vira com sombra, como papel. Desative para uma troca direta."
                      checked={settings.pageTurn !== false}
                      onChange={(v) => onChange({ pageTurn: v })}
                    />
                  )}
                  <Slider
                    theme={theme}
                    label="Margens"
                    value={settings.margin}
                    min={12}
                    max={96}
                    step={4}
                    display={`${settings.margin}px`}
                    onChange={(v) => onChange({ margin: v })}
                  />
                  <Slider
                    theme={theme}
                    label="Largura da coluna"
                    value={settings.maxWidth}
                    min={36}
                    max={90}
                    step={2}
                    display={`${settings.maxWidth} caracteres`}
                    onChange={(v) => onChange({ maxWidth: v })}
                  />
                </>
              )}

              {tab === "luz" && (
                <>
                  <Slider
                    theme={theme}
                    label="Luz âmbar (reduz luz azul)"
                    value={settings.warmth ?? 0}
                    min={0}
                    max={100}
                    step={5}
                    display={`${settings.warmth ?? 0}%`}
                    onChange={(v) => onChange({ warmth: v })}
                  />
                  <Slider
                    theme={theme}
                    label="Escurecer a tela"
                    value={settings.dim ?? 0}
                    min={0}
                    max={70}
                    step={5}
                    display={`${settings.dim ?? 0}%`}
                    onChange={(v) => onChange({ dim: v })}
                  />
                  <Group label="Som ambiente" theme={theme}>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SOUNDS.map((s) => {
                        const active = (settings.ambient ?? "off") === s.value;
                        return (
                          <button
                            key={s.value}
                            onClick={() => {
                              setAmbient(s.value, settings.ambientVolume ?? 0.35);
                              onChange({ ambient: s.value });
                            }}
                            aria-pressed={active}
                            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] transition active:scale-95"
                            style={{
                              boxShadow: `inset 0 0 0 ${active ? 2 : 1}px ${active ? theme.accent : theme.rule}`,
                              color: active ? theme.accent : theme.fg,
                            }}
                          >
                            <s.icon className="h-4 w-4" />
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </Group>
                  {(settings.ambient ?? "off") !== "off" && (
                    <Slider
                      theme={theme}
                      label="Volume"
                      value={Math.round((settings.ambientVolume ?? 0.35) * 100)}
                      min={5}
                      max={100}
                      step={5}
                      display={`${Math.round((settings.ambientVolume ?? 0.35) * 100)}%`}
                      onChange={(v) => {
                        setAmbient(settings.ambient ?? "off", v / 100);
                        onChange({ ambientVolume: v / 100 });
                      }}
                    />
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: theme.muted }}>
                    Os sons são gerados no próprio aparelho, sem baixar nada, e funcionam offline.
                  </p>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Group({
  label,
  theme,
  children,
}: {
  label: string;
  theme: ReaderThemeColors;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: theme.muted }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function SegGroup<T extends string>({
  theme,
  value,
  onChange,
  options,
}: {
  theme: ReaderThemeColors;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-2xl p-1" style={{ background: theme.rule }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition"
            style={{
              background: active ? theme.bg : "transparent",
              color: active ? theme.fg : theme.muted,
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({
  theme,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  theme: ReaderThemeColors;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const id = `rs-${label.replace(/\W+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-xs" style={{ color: theme.muted }}>
          {display}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: theme.accent }}
      />
    </div>
  );
}

function Stepper({
  theme,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  big,
}: {
  theme: ReaderThemeColors;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  big?: boolean;
}) {
  const btn =
    "grid h-12 w-12 place-items-center rounded-2xl transition active:scale-95 disabled:opacity-30";
  return (
    <div>
      <p className="mb-2 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-xs" style={{ color: theme.muted }}>
          {display}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <button
          className={btn}
          style={{ boxShadow: `inset 0 0 0 1px ${theme.rule}` }}
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          aria-label={`Diminuir ${label.toLowerCase()}`}
        >
          {big ? <span className="font-display text-base">A</span> : <Minus className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: theme.accent }}
          aria-label={label}
        />
        <button
          className={btn}
          style={{ boxShadow: `inset 0 0 0 1px ${theme.rule}` }}
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          aria-label={`Aumentar ${label.toLowerCase()}`}
        >
          {big ? <span className="font-display text-2xl">A</span> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  theme,
  label,
  hint,
  checked,
  onChange,
}: {
  theme: ReaderThemeColors;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl p-3.5 text-left"
      style={{ boxShadow: `inset 0 0 0 1px ${theme.rule}` }}
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: theme.muted }}>
          {hint}
        </span>
      </span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? theme.accent : theme.rule }}
      >
        <motion.span
          className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ left: checked ? 24 : 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </span>
    </button>
  );
}
