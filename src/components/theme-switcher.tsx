import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Palette, X } from "lucide-react";
import { useSiteTheme } from "@/hooks/use-site-theme";
import { THEME_LABEL, THEME_PREVIEW, allThemes } from "@/lib/theme";

export function ThemeSwitcher() {
  const [theme, setTheme] = useSiteTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Aparência"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6">
            <button
              aria-label="Fechar seletor de tema"
              className="absolute inset-0 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Escolher aparência"
              className="relative max-h-[min(32rem,calc(100dvh-1.5rem))] w-full max-w-sm overflow-y-auto overscroll-contain rounded-3xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Aparência
                  </p>
                  <p className="mt-0.5 text-sm font-medium">Escolha o tema do BookVerse</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                {allThemes().map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t);
                      setOpen(false);
                    }}
                    className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      theme === t
                        ? "border-gold bg-gold/5 ring-1 ring-gold"
                        : "border-border/60 hover:border-gold/40"
                    }`}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[9px] font-semibold ring-1 ring-black/10"
                      style={{ background: THEME_PREVIEW[t].bg, color: THEME_PREVIEW[t].fg }}
                    >
                      Aa
                    </span>
                    <span className="text-xs font-medium">{THEME_LABEL[t]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
