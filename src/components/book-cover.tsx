import { useEffect, useState } from "react";
import { fetchBookMeta } from "@/lib/google-books";
import { FauxCover } from "@/components/faux-cover";
import { fauxBookFor } from "@/lib/faux-books";

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
  return (
    <CoverWithFallback
      src={resolved ?? null}
      title={title}
      author={author}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      className={className}
    />
  );
}

/** Typographic cover underneath, real artwork fading in once it loads. */
function CoverWithFallback({
  src,
  title,
  author,
  alt,
  width,
  height,
  loading,
  className,
}: {
  src: string | null;
  title: string;
  author?: string;
  alt?: string;
  width: number;
  height: number;
  loading: "lazy" | "eager";
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={{ aspectRatio: "2 / 3" }}>
      <FauxCover
        book={fauxBookFor(title, author ?? "")}
        className="absolute inset-0 h-full w-full !rounded-none"
      />
      {src && !failed && (
        <img
          src={src}
          alt={alt ?? `Capa de ${title}`}
          width={width}
          height={height}
          loading={loading}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
