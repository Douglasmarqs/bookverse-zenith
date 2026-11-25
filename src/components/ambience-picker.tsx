import { motion } from "motion/react";
import { Check } from "lucide-react";

import { useSiteTheme } from "@/hooks/use-site-theme";
import {
  THEME_LABEL,
  THEME_PREVIEW,
  allThemes,
  type ResolvedTheme,
  type SiteTheme,
} from "@/lib/theme";

/** A tiny phone screen in the given appearance. */
function Swatch({ theme, half }: { theme: ResolvedTheme; half?: "left" | "right" }) {
  const c = THEME_PREVIEW[theme];
  return (
    <span
      className="absolute inset-0 overflow-hidden"
      style={{
        background: c.bg,
        clipPath:
          half === "left" ? "inset(0 50% 0 0)" : half === "right" ? "inset(0 0 0 50%)" : undefined,
      }}
    >
      <span
        className="absolute left-2.5 top-2.5 h-1.5 w-8 rounded-full"
        style={{ background: c.fg, opacity: 0.8 }}
      />
      <span
        className="absolute inset-x-2.5 top-6 h-8 rounded-[8px]"
        style={{ background: "#1D4A37", boxShadow: "0 4px 10px -6px rgb(0 0 0 / .5)" }}
      />
      <span className="absolute bottom-2.5 left-2.5 right-2.5 flex gap-1.5">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="h-5 flex-1 rounded-[6px]"
            style={{ background: c.surface, boxShadow: `inset 0 0 0 1px ${c.fg}18` }}
          />
        ))}
      </span>
      <span
        className="absolute bottom-9 left-2.5 h-1.5 w-1.5 rounded-full"
        style={{ background: c.accent }}
      />
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
      aria-label="Aparência do aplicativo"
      className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}
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
            className="press group flex flex-col items-center gap-2 text-center"
          >
            <span
              className={`relative block w-full overflow-hidden rounded-2xl ${compact ? "h-20" : "h-28"} ${
                selected ? "ring-[2.5px] ring-gold" : "ring-1 ring-border"
              }`}
            >
              {t === "auto" ? (
                <>
                  <Swatch theme="claro" half="left" />
                  <Swatch theme="escuro" half="right" />
                </>
              ) : (
                <Swatch theme={t} />
              )}
              {selected && (
                <motion.span
                  layoutId="ambience-check"
                  className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-white"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}
            </span>
            <span
              className={`text-xs font-semibold ${selected ? "text-foreground" : "text-muted-foreground"}`}
            >
              {THEME_LABEL[t]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
