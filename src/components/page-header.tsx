import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Editorial page opening shared by the app's inner pages. */
export function PageHeader({
  eyebrow,
  title,
  accent,
  children,
  aside,
}: {
  eyebrow: ReactNode;
  title: string;
  /** Words rendered in italic brass after the title. */
  accent?: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={reduce ? false : { opacity: 0.55, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-wrap items-end justify-between gap-5"
    >
      <div
        aria-hidden
        className="lamp-glow lamp-breathe pointer-events-none absolute -left-40 -top-72 -z-10 h-[40rem] w-[40rem]"
      />
      <div className="max-w-3xl">
        <p className="eyebrow flex items-center gap-2">{eyebrow}</p>
        <h1 className="mt-2 font-display text-[40px] leading-[0.98] sm:text-5xl md:text-6xl">
          {title} {accent && <span className="italic text-gold">{accent}</span>}
        </h1>
        {children && (
          <div className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            {children}
          </div>
        )}
      </div>
      {aside}
    </motion.header>
  );
}
