import { Link } from "@tanstack/react-router";

/** The BookVerse mark: an open book with a spark, drawn inline so it
 * inherits theme colours and stays crisp at any size. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="bv-mark" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5AA7FF" />
          <stop offset=".55" stopColor="#1769D8" />
          <stop offset="1" stopColor="#0A3F9E" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#bv-mark)" />
      <path d="M7.5 13.6c4.3-2 8.8-1.1 12.5 2.3v14.4c-3.7-3.4-8.2-4.3-12.5-2.3V13.6Z" fill="#fff" />
      <path
        d="M32.5 13.6c-4.3-2-8.8-1.1-12.5 2.3v14.4c3.7-3.4 8.2-4.3 12.5-2.3V13.6Z"
        fill="#EAF4FF"
      />
      <path
        d="M10 17.2c2.6-.8 5.6-.2 7.8 1.7M10 20.6c2.6-.8 5.6-.2 7.8 1.7M30 17.2c-2.6-.8-5.6-.2-7.8 1.7M30 20.6c-2.6-.8-5.6-.2-7.8 1.7"
        fill="none"
        stroke="#64A8F8"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
      <path d="m20 4.6.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2Z" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight ${className}`}>
      Book<span className="text-gold">Verse</span>
    </span>
  );
}

export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <Link
      to="/"
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="BookVerse — início"
    >
      <LogoMark
        size={size}
        className="drop-shadow-[0_8px_16px_rgba(23,105,216,0.28)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
      />
      <Wordmark className="text-[1.35rem]" />
    </Link>
  );
}
