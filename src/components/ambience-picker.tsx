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

/** A tiny scene of the ambience: page, shelf of spines and accent. */
function Swatch({ theme }: { theme: ResolvedTheme }) {
  const c = THEME_PREVIEW[theme];
  return (
    <span className="absolute inset-0 flex flex-col p-2" style={{ background: c.bg }}>
      <span className="h-1.5 w-8 rounded-full" style={{ background: c.accent }} />
      <span className="mt-1 h-1 w-12 rounded-full opacity-60" style={{ background: c.fg }} />
      <span className="mt-auto flex items-end gap-[3px]">
        {[0.9, 0.7, 1, 0.8, 0.6].map((h, i) => (
          <span
            key={i}
            className="w-[7px] rounded-t-[1px]"
            style={{
              height: `${h * 22}px`,
              background: i === 2 ? c.accent : c.surface,
              boxShadow: `inset 0 0 0 1px ${c.fg}22`,
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
