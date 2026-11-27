/**
 * The pull-up sheet for PDFs in page mode — same gesture and look as the
 * EPUB reader's. Page mode shows the original printed page, so text
 * settings (font, themes, page-turn style) live in Modo leitura; this
 * sheet says so plainly and offers everything that does apply here:
 * Lumi about the page, ambient sound, brightness/contrast/margins and the
 * leaf effect.
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CloudRain,
  Flame,
  Headphones,
  Info,
  Languages,
  SlidersHorizontal,
  Sparkles,
  Type,
  Volume2,
  Waves,
  X,
} from "lucide-react";

import { setAmbient, stopAmbient } from "@/lib/ambient-sound";
import { loadSettings, saveSettings, type AmbientSound } from "@/lib/reader-store";

const SOUNDS: { value: AmbientSound; label: string; icon: typeof CloudRain }[] = [
  { value: "off", label: "Silêncio", icon: Volume2 },
  { value: "chuva", label: "Chuva", icon: CloudRain },
  { value: "lareira", label: "Lareira", icon: Flame },
  { value: "mar", label: "Mar", icon: Waves },
  { value: "foco", label: "Foco", icon: Headphones },
];

export function PdfPullSheet({
  hasReadingMode,
  pageTurnEnabled,
  onTogglePageTurn,
  onReadingMode,
  onAsk,
  onDisplaySettings,
  hidden,
}: {
  hasReadingMode: boolean;
  pageTurnEnabled: boolean;
  onTogglePageTurn: () => void;
  onReadingMode: () => void;
  onAsk: (topic: "question" | "translation" | "summary", prompt?: string) => void;
  onDisplaySettings: () => void;
  hidden: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ambient, setAmbientState] = useState<AmbientSound>("off");
  const drag = useRef<number | null>(null);

  useEffect(() => {
    setAmbientState(loadSettings().ambient ?? "off");
  }, []);
  // The soundscape belongs to this page: it stops when the PDF closes.
  useEffect(() => () => stopAmbient(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const choose = (value: AmbientSound) => {
    setAmbientState(value);
    const s = loadSettings();
    saveSettings({ ...s, ambient: value, updatedAt: Date.now() });
    setAmbient(value, s.ambientVolume ?? 0.35);
  };
  const ask = (topic: "question" | "translation" | "summary", prompt?: string) => {
    setOpen(false);
    onAsk(topic, prompt);
  };

  return (
    <>
      {!hidden && !open && (
        <button
          type="button"
          aria-label="Abrir ajustes e Lumi"
          onClick={() => setOpen(true)}
          onPointerDown={(e) => {
            drag.current = e.clientY;
          }}
          onPointerMove={(e) => {
            if (drag.current !== null && drag.current - e.clientY > 24) {
              drag.current = null;
              setOpen(true);
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          className="absolute inset-x-0 bottom-0 z-20 mx-auto flex h-9 w-40 touch-none items-end justify-center pb-2"
        >
          <span className="h-[5px] w-11 rounded-full bg-foreground/25" />
        </button>
      )}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/35"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Ajustes do PDF e Lumi"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 500) setOpen(false);
              }}
              className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[82dvh] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-t-[30px] bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-2xl"
            >
              <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-foreground/15" />
              <div className="flex items-center justify-between">
                <p className="font-display text-xl">Ajustes deste PDF</p>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-surface-2"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="mt-3 flex gap-3 rounded-[18px] bg-accent-soft p-3.5">
                <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gold" />
                <div className="min-w-0 text-[13px] leading-snug">
                  <p className="font-semibold">Você está no modo página</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Ele mostra a página original do PDF.{" "}
                    {hasReadingMode
                      ? "Fonte, temas, tamanho da letra e estilo de virar página ficam no Modo leitura."
                      : "Este PDF é escaneado (só imagem), então fonte e temas não se aplicam a ele."}
                  </p>
                  {hasReadingMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onReadingMode();
                      }}
                      className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13px] font-semibold text-background"
                    >
                      <Type className="h-4 w-4" /> Abrir no Modo leitura
                    </button>
                  )}
                </div>
              </div>

              <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pergunte à Lumi
              </p>
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    ["question", "Explique esta página", Sparkles],
                    ["summary", "Resuma esta página", BookOpen],
                    ["translation", "Traduza esta página", Languages],
                  ] as const
                ).map(([topic, label, Icon]) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => ask(topic, label)}
                    className="flex h-12 items-center gap-3 rounded-[16px] bg-surface-2 px-4 text-left text-[14.5px] font-semibold"
                  >
                    <Icon className="h-[18px] w-[18px] text-gold" /> {label}
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Som ambiente
              </p>
              <div className="flex gap-2">
                {SOUNDS.map((sd) => {
                  const on = ambient === sd.value;
                  const Icon = sd.icon;
                  return (
                    <button
                      key={sd.value}
                      type="button"
                      onClick={() => choose(sd.value)}
                      aria-pressed={on}
                      className={`flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[16px] text-[10.5px] font-semibold ${
                        on ? "bg-foreground text-background" : "bg-surface-2"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {sd.label}
                    </button>
                  );
                })}
              </div>

              <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Página
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onDisplaySettings();
                  }}
                  className="flex h-12 items-center justify-center gap-2 rounded-[16px] bg-surface-2 text-[13.5px] font-semibold"
                >
                  <SlidersHorizontal className="h-4 w-4" /> Brilho e margens
                </button>
                <button
                  type="button"
                  onClick={onTogglePageTurn}
                  aria-pressed={pageTurnEnabled}
                  className={`flex h-12 items-center justify-center gap-2 rounded-[16px] text-[13.5px] font-semibold ${
                    pageTurnEnabled ? "bg-foreground text-background" : "bg-surface-2"
                  }`}
                >
                  <BookOpen className="h-4 w-4" /> Efeito de folha
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
