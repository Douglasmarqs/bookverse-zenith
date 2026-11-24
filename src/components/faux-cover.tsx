/**
 * Generated book covers — flat colour, one geometric motif and the title set
 * like a modern classics series. Pure SVG: crisp at any size, theme-safe and
 * never dependent on a third-party image host.
 */
import { useId } from "react";
import { motifSvg, type FauxBook } from "@/lib/faux-books";

/** Title lines: hand-set for the classics, otherwise one line when it fits
 * and balanced breaks (max four lines) when it doesn't. */
function titleLines(book: FauxBook): string[] {
  if (book.lines?.length) return book.lines;
  const title = book.title.trim();
  if (title.length <= 14) return [title];
  const words = title.split(/\s+/).filter(Boolean);
  const max = title.length > 28 ? 13 : 12;
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= max) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  if (lines.length > 4) return [...lines.slice(0, 3), lines.slice(3).join(" ")];
  return lines;
}

export function FauxCover({
  book,
  className = "",
  showText = true,
}: {
  book: FauxBook;
  className?: string;
  showText?: boolean;
  /** Kept for older call sites; the art already leaves room at the top. */
  padTop?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const lines = titleLines(book);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const rule = lines.length >= 3 ? 21 : lines.join("").length > 14 ? 24 : 30;
  // Same sizing as the approved covers, shrunk only when a line wouldn't fit.
  const fit = 172 / (longest * (book.serif ? 0.42 : 0.56));
  const fs = Math.min(rule * (book.serif ? 1.12 : 1), fit) / (book.serif ? 1.12 : 1);
  const art = motifSvg(book);
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[4px_8px_8px_4px] ${className}`}
      role="img"
      aria-label={`${book.title}, de ${book.author}`}
    >
      <svg viewBox="0 0 200 300" width="100%" height="100%" className="block" aria-hidden="true">
        <defs>
          <linearGradient id={`s${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity=".28" />
            <stop offset=".05" stopColor="#fff" stopOpacity=".14" />
            <stop offset=".09" stopColor="#000" stopOpacity=".06" />
            <stop offset=".2" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity=".04" />
          </linearGradient>
        </defs>
        <rect width="200" height="300" fill={book.bg} />
        <g
          transform={
            lines.length >= 3 ? "translate(100 128) scale(0.8) translate(-100 -150)" : undefined
          }
          dangerouslySetInnerHTML={{ __html: art }}
        />
        {showText && (
          <>
            <text
              x="16"
              y="34"
              fontFamily="Inter Variable, sans-serif"
              fontWeight={600}
              fontSize="9.5"
              letterSpacing="1.6"
              fill={book.fg}
              fillOpacity=".8"
            >
              {book.author.toUpperCase().slice(0, 30)}
            </text>
            {lines.map((l, i) => (
              <text
                key={i}
                x="16"
                y={250 - (lines.length - 1 - i) * fs * 0.98}
                fontFamily={
                  book.serif
                    ? "Instrument Serif, Georgia, serif"
                    : "Bricolage Grotesque Variable, sans-serif"
                }
                fontWeight={book.serif ? 400 : 760}
                fontSize={book.serif ? fs * 1.12 : fs}
                letterSpacing={book.serif ? 0 : -0.8}
                fill={book.fg}
              >
                {l}
              </text>
            ))}
          </>
        )}
        <rect width="200" height="300" fill={`url(#s${id})`} />
      </svg>
    </div>
  );
}
