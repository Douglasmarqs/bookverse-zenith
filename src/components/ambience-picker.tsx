import { motion } from "motion/react";
import { Check } from "lucide-react";

import { useSiteTheme } from "@/hooks/use-site-theme";
import {
  THEME_DESCRIPTION,
  THEME_LABEL,
  THEME_PREVIEW,
  allThemes,
  type ResolvedTheme,
  type SiteTheme,
} from "@/lib/theme";

/** A tiny scene of the ambience: a lamp glow, a page and a shelf of spines. */
function Swatch({ theme }: { theme: ResolvedTheme }) {
  const c = THEME_PREVIEW[theme];
  return (
    <span className="absolute inset-0 overflow-hidden" style={{ background: c.bg }}>
      <span
        className="absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-40 blur-xl"
        style={{ background: c.accent }}
      />
      <span
        className="absolute left-2.5 top-2.5 h-1.5 w-7 rounded-full"
        style={{ background: c.accent }}
      />
      <span
        className="absolute left-2.5 top-5 h-1 w-11 rounded-full opacity-50"
        style={{ background: c.fg }}
      />
      <span className="absolute bottom-2.5 left-2.5 flex items-end gap-[3px]">
        {[0.9, 0.7, 1, 0.8, 0.6].map((h, i) => (
          <span
            key={i}
            className="w-[7px] rounded-t-[1px]"
            style={{
              height: `${h * 26}px`,
              background: i === 2 ? c.accent : c.surface,
              boxShadow: `inset 0 0 0 1px ${c.fg}22`,
            }}
          />
        ))}
      </span>
      <span
        className="absolute bottom-2.5 right-2.5 top-7 flex w-[46%] flex-col gap-[5px] rounded-[4px] p-2"
        style={{ background: c.surface, boxShadow: `0 6px 14px -8px rgb(0 0 0 / 0.5)` }}
      >
        {[1, 0.86, 0.94, 0.6].map((w, i) => (
          <span
            key={i}
            className="h-[3px] rounded-full"
            style={{
              width: `${w * 100}%`,
              background: i === 1 ? c.accent : c.fg,
              opacity: i === 1 ? 0.9 : 0.35,
            }}
          />
        ))}
      </span>
    </span>
  );
}

export function AmbiencePicker({
  compact = false,
  onPicked,
}: {
  compact?: boolean;
  onPicked?: (t: SiteTheme) => void;
}) {
  const [theme, setTheme] = useSiteTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Ambiente do aplicativo"
      className={`grid gap-2.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}
    >
      {allThemes().map((t) => {
        const selected = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              setTheme(t);
              onPicked?.(t);
            }}
            className="press group relative rounded-2xl border border-border p-1.5 text-left transition-colors hover:border-gold/50"
          >
            <span className="relative block aspect-[16/10] overflow-hidden rounded-xl ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-[1.02]">
              {t === "auto" ? (
                <>
                  <span
                    className="absolute inset-0"
                    style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
                  >
                    <Swatch theme="papel" />
                  </span>
                  <span
                    className="absolute inset-0"
                    style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
                  >
                    <Swatch theme="noturna" />
                  </span>
                </>
              ) : (
                <Swatch theme={t} />
              )}
            </span>
            <span className="mt-2 flex items-center justify-between gap-2 px-1 pb-0.5">
              <span className="text-[13px] font-semibold">{THEME_LABEL[t]}</span>
              {selected && (
                <motion.span
                  layoutId="ambience-check"
                  className="grid h-5 w-5 place-items-center rounded-full bg-gold text-primary-foreground"
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                >
                  <Check className="h-3 w-3" />
                </motion.span>
              )}
            </span>
            {!compact && (
              <span className="block px-1 pb-1 text-[11px] leading-snug text-muted-foreground">
                {THEME_DESCRIPTION[t]}
              </span>
            )}
            {selected && (
              <motion.span
                layoutId="ambience-ring"
                className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-gold"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
