import { Link } from "@tanstack/react-router";

/**
 * The BookVerse mark: an open book whose right page is the brand vermilion.
 * Ink and page colours follow the theme, so it works on light and dark.
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className={className}>
      <rect width="40" height="40" rx="12" style={{ fill: "var(--parchment)" }} />
      <path
        d="M10 12.5c3.6-1.4 7-.9 10 1.6v15.2c-3-2.5-6.4-3-10-1.6V12.5Z"
        style={{ fill: "var(--ink)" }}
      />
      <path
        d="M30 12.5c-3.6-1.4-7-.9-10 1.6v15.2c3-2.5 6.4-3 10-1.6V12.5Z"
        style={{ fill: "var(--gold)" }}
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-[760] tracking-[-0.045em] text-foreground ${className}`}>
      bookverse
    </span>
  );
}

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Link
      to="/"
      className={`press group flex items-center gap-2.5 ${className}`}
      aria-label="BookVerse — início"
    >
      <LogoMark size={size} className="transition-transform duration-500 group-hover:-rotate-6" />
      <Wordmark className="text-[1.45rem] leading-none max-[359px]:hidden" />
    </Link>
  );
}
