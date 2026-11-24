import { Link } from "@tanstack/react-router";
import { useId } from "react";

/**
 * The BookVerse mark: an open book under a small spark, cut from a brass
 * tile. Colours come from the active ambience, so the mark is latão in
 * Noturna, prata in Meia-noite, ouro rosé in Bordô…
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className={className}>
      <defs>
        <linearGradient
          id={`bv-${id}`}
          x1="6"
          y1="2"
          x2="34"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop style={{ stopColor: "var(--gold-soft)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--gold)" }} />
          <stop offset="1" style={{ stopColor: "var(--oxide)" }} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#bv-${id})`} />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="10.5"
        fill="none"
        stroke="white"
        strokeOpacity="0.25"
      />
      <path
        d="M8.5 14.2c4-1.6 8-.8 11.5 2.3v13.6c-3.5-3.1-7.5-3.9-11.5-2.3V14.2Z"
        style={{ fill: "var(--primary-foreground)" }}
      />
      <path
        d="M31.5 14.2c-4-1.6-8-.8-11.5 2.3v13.6c3.5-3.1 7.5-3.9 11.5-2.3V14.2Z"
        style={{ fill: "var(--primary-foreground)" }}
        fillOpacity="0.82"
      />
      <path
        d="m20 5.2.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Z"
        style={{ fill: "var(--primary-foreground)" }}
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display tracking-tight ${className}`}>
      Book<span className="italic text-gold">Verse</span>
    </span>
  );
}

export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <Link
      to="/"
      className={`press group flex items-center gap-2.5 ${className}`}
      aria-label="BookVerse — início"
    >
      <LogoMark
        size={size}
        className="drop-shadow-[0_8px_18px_color-mix(in_oklab,var(--gold)_45%,transparent)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105"
      />
      <Wordmark className="text-[1.55rem] leading-none" />
    </Link>
  );
}
