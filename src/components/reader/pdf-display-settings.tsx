import { BookOpen, Contrast, Settings2, SunMedium, Type, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import type { PdfDisplaySettings } from "@/lib/pdf-display-settings";

export function PdfDisplaySettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  pageTurnEnabled,
  onTogglePageTurn,
}: {
  open: boolean;
  onClose: () => void;
  settings: PdfDisplaySettings;
  onChange: (patch: Partial<PdfDisplaySettings>) => void;
  pageTurnEnabled: boolean;
  onTogglePageTurn: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled])",
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          event.clientX < event.currentTarget.getBoundingClientRect().left
        )
          onClose();
      }}
      className="fixed inset-0 m-0 ml-auto h-dvh max-h-none w-full max-w-sm flex-col border-l border-blue-100 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm open:flex"
    >
      <header className="flex items-center justify-between border-b border-blue-100 px-5 py-4">
        <div>
          <h2 id={titleId} className="font-display text-xl font-semibold">
            Ajustes do PDF
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Visualização da página digitalizada</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-blue-50"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Ajustar página</legend>
          <div className="flex gap-2">
            {(
              [
                ["page", "Página inteira"],
                ["width", "Largura da tela"],
              ] as const
            ).map(([fit, label]) => (
              <label
                key={fit}
                className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-blue-100 p-3 text-xs"
              >
                <input
                  type="radio"
                  name={`${titleId}-fit`}
                  value={fit}
                  checked={settings.fit === fit}
                  onChange={() => onChange({ fit, zoom: 1 })}
                  className="accent-blue-600"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Virada de página
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={pageTurnEnabled}
            onClick={onTogglePageTurn}
            className="flex w-full items-center justify-between rounded-2xl border border-blue-100 p-4 text-left"
          >
            <span className="flex gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 text-blue-600" />
              <span>
                <span className="block text-sm font-semibold">Efeito de folha</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  Anima a página no celular e no navegador.
                </span>
              </span>
            </span>
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${pageTurnEnabled ? "bg-blue-600" : "bg-slate-200"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${pageTurnEnabled ? "translate-x-6" : "translate-x-1"}`}
              />
            </span>
          </button>
        </section>

        <PdfSlider
          icon={<Type className="h-4 w-4" />}
          label="Tamanho da página e letras"
          value={settings.zoom}
          min={0.75}
          max={2}
          step={0.05}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(zoom) => onChange({ zoom })}
        />
        <PdfSlider
          icon={<Settings2 className="h-4 w-4" />}
          label="Margem ao redor da página"
          value={settings.pagePadding}
          min={4}
          max={48}
          step={4}
          format={(value) => `${value}px`}
          onChange={(pagePadding) => onChange({ pagePadding })}
        />
        <PdfSlider
          icon={<SunMedium className="h-4 w-4" />}
          label="Brilho do papel"
          value={settings.brightness}
          min={0.75}
          max={1.25}
          step={0.05}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(brightness) => onChange({ brightness })}
        />
        <PdfSlider
          icon={<Contrast className="h-4 w-4" />}
          label="Contraste do texto"
          value={settings.contrast}
          min={0.75}
          max={1.5}
          step={0.05}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(contrast) => onChange({ contrast })}
        />

        <p
          id={descriptionId}
          className="rounded-2xl bg-blue-50 p-4 text-xs leading-relaxed text-slate-600"
        >
          Este PDF não possui uma camada de texto confiável. Por isso o BookVerse amplia a página
          inteira sem alterar a diagramação. PDFs com texto selecionável usam automaticamente os
          controles completos de fonte, linhas, parágrafos e largura.
        </p>
      </div>
    </dialog>
  );
}

function PdfSlider({
  icon,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {icon}
          {label}
        </span>
        <span className="tabular-nums text-blue-700">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-600"
      />
    </label>
  );
}
