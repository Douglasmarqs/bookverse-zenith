import { X, Type, AlignJustify, Rows3, Columns2, Sun, Moon, BookOpen } from "lucide-react";
import type { ReaderSettings, ReaderTheme, ReaderFont, ReaderMode } from "@/lib/reader-store";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
}

export function ReaderSettingsPanel({ open, onClose, settings, onChange }: Props) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border/60 bg-background shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h3 className="font-display text-lg font-medium">Ajustes de leitura</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
          <Group label="Tema">
            <SegGroup
              value={settings.theme}
              onChange={(v) => onChange({ theme: v as ReaderTheme })}
              options={[
                { value: "light", label: "Claro", icon: <Sun className="h-3.5 w-3.5" /> },
                { value: "sepia", label: "Sépia", icon: <BookOpen className="h-3.5 w-3.5" /> },
                { value: "dark", label: "Escuro", icon: <Moon className="h-3.5 w-3.5" /> },
              ]}
            />
          </Group>

          <Group label="Fonte">
            <SegGroup
              value={settings.font}
              onChange={(v) => onChange({ font: v as ReaderFont })}
              options={[
                { value: "serif", label: "Serifada" },
                { value: "sans", label: "Sem serifa" },
              ]}
            />
          </Group>

          <Group label="Modo de leitura">
            <SegGroup
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
            label="Margens laterais"
            value={settings.margin}
            min={16}
            max={96}
            step={4}
            unit="px"
            onChange={(v) => onChange({ margin: v })}
          />

          <Slider
            label="Largura do texto"
            value={settings.maxWidth}
            min={40}
            max={90}
            step={2}
            unit="ch"
            onChange={(v) => onChange({ maxWidth: v })}
          />
        </div>

        <footer className="border-t border-border/60 px-5 py-4 text-xs text-muted-foreground">
          Suas preferências são salvas automaticamente.
        </footer>
      </aside>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function SegGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-full border border-border/60 bg-secondary/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${
            value === o.value
              ? "bg-gold text-primary-foreground shadow-sm"
              : "text-foreground/75 hover:text-foreground"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
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
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/85">
          {icon}
          {label}
        </span>
        <span className="text-xs tabular-nums text-gold">
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
        className="w-full accent-gold"
      />
    </div>
  );
}
