import { X, Type, AlignJustify, Rows3, Columns2 } from "lucide-react";
import type { ReaderSettings, ReaderTheme, ReaderFont, ReaderMode } from "@/lib/reader-store";

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
  { value: "paper", label: "Papel", bg: "#F2ECE1", fg: "#2A2420" },
  { value: "sepia", label: "Sépia", bg: "#EFE0C0", fg: "#3A2818" },
  { value: "dark", label: "Escuro", bg: "#0E0B08", fg: "#E8DFD3" },
];

/**
 * This panel deliberately does NOT use the sitewide `bg-background` /
 * `text-foreground` / etc. Tailwind classes — those follow the site-wide
 * Claro/Sépia/Papel/Escuro theme (see lib/theme.ts), which is a separate,
 * independent setting from the reader's own theme. Using the site theme
 * here would make the settings panel visually clash with whatever reading
 * theme is actually active (e.g. a dark site theme showing a dark panel
 * floating over a Sépia reading page). Every color below comes from the
 * `theme` prop instead, so this panel always matches the page behind it.
 */
export function ReaderSettingsPanel({ open, onClose, settings, onChange, theme }: Props) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          backgroundColor: theme.bg,
          color: theme.fg,
          borderLeft: `1px solid ${theme.rule}`,
          transition: "background-color 0.3s ease, color 0.3s ease, transform 0.3s ease",
        }}
        aria-hidden={!open}
      >
        <header
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${theme.rule}` }}
        >
          <h3 className="font-display text-lg font-medium">Ajustes de leitura</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
          <Group label="Tema" theme={theme}>
            <div className="grid grid-cols-2 gap-2.5">
              {THEME_SWATCHES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => onChange({ theme: t.value })}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition"
                  style={{
                    borderColor: settings.theme === t.value ? theme.accent : theme.rule,
                    boxShadow: settings.theme === t.value ? `0 0 0 1px ${theme.accent}` : "none",
                  }}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold ring-1 ring-black/10"
                    style={{ background: t.bg, color: t.fg }}
                  >
                    Aa
                  </span>
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group label="Fonte" theme={theme}>
            <SegGroup
              theme={theme}
              value={settings.font}
              onChange={(v) => onChange({ font: v as ReaderFont })}
              options={[
                { value: "serif", label: "Serifada" },
                { value: "sans", label: "Sem serifa" },
              ]}
            />
          </Group>

          <Group label="Modo de leitura" theme={theme}>
            <SegGroup
              theme={theme}
              value={settings.mode}
              onChange={(v) => onChange({ mode: v as ReaderMode })}
              options={[
                { value: "scroll", label: "Rolagem", icon: <Rows3 className="h-3.5 w-3.5" /> },
                {
                  value: "paginated",
                  label: "Páginas",
                  icon: <Columns2 className="h-3.5 w-3.5" />,
                },
              ]}
            />
          </Group>

          <Slider
            theme={theme}
            label="Tamanho da fonte"
            icon={<Type className="h-3.5 w-3.5" />}
            value={settings.fontSize}
            min={14}
            max={28}
            step={1}
            unit="px"
            onChange={(v) => onChange({ fontSize: v })}
          />

          <Slider
            theme={theme}
            label="Espaçamento entre linhas"
            icon={<AlignJustify className="h-3.5 w-3.5" />}
            value={settings.lineHeight}
            min={1.3}
            max={2.2}
            step={0.05}
            unit=""
            onChange={(v) => onChange({ lineHeight: Math.round(v * 100) / 100 })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            theme={theme}
            label="Margens laterais"
            value={settings.margin}
            min={16}
            max={96}
            step={4}
            unit="px"
            onChange={(v) => onChange({ margin: v })}
          />

          <Slider
            theme={theme}
            label="Largura do texto"
            value={settings.maxWidth}
            min={40}
            max={90}
            step={2}
            unit="ch"
            onChange={(v) => onChange({ maxWidth: v })}
          />
        </div>

        <footer
          className="px-5 py-4 text-xs"
          style={{ borderTop: `1px solid ${theme.rule}`, color: theme.muted }}
        >
          Suas preferências são salvas automaticamente. O tema escolhido aqui é só para a leitura —
          independente do tema do restante do site.
        </footer>
      </aside>
    </>
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
      <p className="mb-2.5 text-[11px] uppercase tracking-[0.22em]" style={{ color: theme.muted }}>
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
    <div
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-full border p-1"
      style={{ borderColor: theme.rule }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition"
            style={
              active ? { backgroundColor: theme.accent, color: theme.bg } : { color: theme.muted }
            }
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
  icon,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  format,
}: {
  theme: ReaderThemeColors;
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: theme.fg }}>
          {icon}
          {label}
        </span>
        <span className="text-xs tabular-nums" style={{ color: theme.accent }}>
          {display}
          {unit}
        </span>
      </div>
      <input
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
