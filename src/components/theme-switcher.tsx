import { useState } from "react";
import { Palette } from "lucide-react";
import { useSiteTheme } from "@/hooks/use-site-theme";
import { THEME_LABEL, THEME_PREVIEW, allThemes } from "@/lib/theme";

export function ThemeSwitcher() {
  const [theme, setTheme] = useSiteTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Aparência"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <>
          {/* Mobile: full backdrop + bottom sheet, so the picker can never
              overflow off-screen regardless of where this button sits in
              the header. Desktop (sm:) keeps the small anchored dropdown. */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64"
            onMouseLeave={() => setOpen(false)}
          >
            <p className="px-1 pb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Aparência
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allThemes().map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                    theme === t
                      ? "border-gold ring-1 ring-gold"
                      : "border-border/60 hover:border-gold/40"
                  }`}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-semibold ring-1 ring-black/10"
                    style={{ background: THEME_PREVIEW[t].bg, color: THEME_PREVIEW[t].fg }}
                  >
                    Aa
                  </span>
                  <span className="text-xs font-medium">{THEME_LABEL[t]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
