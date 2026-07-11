import { useEffect, useState } from "react";
import { fetchBookMeta } from "@/lib/google-books";

interface BookCoverProps {
  title: string;
  author?: string;
  fallbackSrc?: string;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
}

/**
 * Resolves and renders the real cover for a book via Google Books. Shows a
 * soft skeleton while loading and falls back to `fallbackSrc` (or a plain
 * gradient) if no real cover is found.
 */
export function BookCover({
  title,
  author,
  fallbackSrc,
  className,
  alt,
  width = 800,
  height = 1200,
  loading = "lazy",
}: BookCoverProps) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setSrc(undefined);
    fetchBookMeta(title, author).then((meta) => {
      if (!cancelled) setSrc(meta?.cover ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [title, author]);

  if (src === undefined) {
    return (
      <div
        className={`animate-pulse bg-secondary ${className ?? ""}`}
        style={{ aspectRatio: "2 / 3" }}
        aria-hidden
      />
    );
  }

  const resolved = src ?? fallbackSrc;

  if (!resolved) {
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br from-secondary to-secondary/60 p-3 text-center ${className ?? ""}`}
        style={{ aspectRatio: "2 / 3" }}
      >
        <span className="font-display text-xs leading-snug text-foreground/70">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt ?? title}
      width={width}
      height={height}
      loading={loading}
      className={className}
      onError={(e) => {
        if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
          e.currentTarget.src = fallbackSrc;
        }
      }}
    />
  );
}
