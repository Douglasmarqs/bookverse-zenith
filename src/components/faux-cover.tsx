/**
 * Typographic book covers for marketing surfaces. Real public-domain
 * titles, drawn in CSS so they are crisp, theme-safe and never depend on a
 * third-party image host being reachable.
 */
export interface FauxBook {
  title: string;
  author: string;
  bg: string;
  fg: string;
  accent: string;
  motif: "arc" | "stripes" | "circle" | "diamond" | "wave" | "frame";
}

export const FAUX_BOOKS: FauxBook[] = [
  {
    title: "Dom Casmurro",
    author: "Machado de Assis",
    bg: "#14324f",
    fg: "#f4ead7",
    accent: "#e0b35c",
    motif: "circle",
  },
  {
    title: "Orgulho e Preconceito",
    author: "Jane Austen",
    bg: "#f1e4d3",
    fg: "#3b2a22",
    accent: "#b5523b",
    motif: "frame",
  },
  {
    title: "Frankenstein",
    author: "Mary Shelley",
    bg: "#1d2b22",
    fg: "#e6efe2",
    accent: "#8fd19e",
    motif: "stripes",
  },
  {
    title: "A Metamorfose",
    author: "Franz Kafka",
    bg: "#e7d24a",
    fg: "#1d1b16",
    accent: "#1d1b16",
    motif: "diamond",
  },
  {
    title: "Memórias Póstumas",
    author: "Machado de Assis",
    bg: "#5b1f2b",
    fg: "#f6e7df",
    accent: "#f0a66b",
    motif: "arc",
  },
  {
    title: "Moby Dick",
    author: "Herman Melville",
    bg: "#0f4c6b",
    fg: "#e8f4fa",
    accent: "#7fd3f5",
    motif: "wave",
  },
  {
    title: "O Cortiço",
    author: "Aluísio Azevedo",
    bg: "#c9572f",
    fg: "#fff3e6",
    accent: "#2b1a12",
    motif: "stripes",
  },
  {
    title: "Iracema",
    author: "José de Alencar",
    bg: "#2f5d3a",
    fg: "#f2f0dc",
    accent: "#e6c25a",
    motif: "arc",
  },
  {
    title: "Drácula",
    author: "Bram Stoker",
    bg: "#121212",
    fg: "#f0e6e6",
    accent: "#c0262d",
    motif: "frame",
  },
  {
    title: "Alice no País das Maravilhas",
    author: "Lewis Carroll",
    bg: "#bfe0ef",
    fg: "#1c2b4a",
    accent: "#e2577c",
    motif: "circle",
  },
  {
    title: "O Alienista",
    author: "Machado de Assis",
    bg: "#2b2350",
    fg: "#efeaff",
    accent: "#a99cff",
    motif: "diamond",
  },
  {
    title: "Sherlock Holmes",
    author: "Arthur Conan Doyle",
    bg: "#3a2c20",
    fg: "#f3e6cf",
    accent: "#d9a35a",
    motif: "wave",
  },
];

function Motif({ motif, color }: { motif: FauxBook["motif"]; color: string }) {
  const common = { fill: "none", stroke: color, strokeWidth: 1.4, opacity: 0.85 } as const;
  switch (motif) {
    case "circle":
      return <circle cx="50" cy="62" r="18" {...common} />;
    case "arc":
      return <path d="M22 80a28 28 0 0 1 56 0" {...common} />;
    case "diamond":
      return <path d="M50 42 70 62 50 82 30 62Z" {...common} />;
    case "wave":
      return (
        <path
          d="M18 62c8-8 16 8 24 0s16 8 24 0 16 8 16 0M18 72c8-8 16 8 24 0s16 8 24 0 16 8 16 0"
          {...common}
        />
      );
    case "stripes":
      return (
        <g {...common}>
          <path d="M20 54h60M20 62h60M20 70h60" />
        </g>
      );
    case "frame":
    default:
      return <rect x="16" y="14" width="68" height="122" rx="2" {...common} />;
  }
}

export function FauxCover({
  book,
  className = "",
  showText = true,
}: {
  book: FauxBook;
  className?: string;
  showText?: boolean;
}) {
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[6px] ${className}`}
      style={{
        background: `linear-gradient(160deg, ${book.bg}, color-mix(in oklab, ${book.bg} 78%, black))`,
        color: book.fg,
        containerType: "inline-size",
        boxShadow:
          "inset 3px 0 0 rgb(255 255 255 / 0.08), inset 7px 0 10px -6px rgb(0 0 0 / 0.45), 0 24px 40px -22px rgb(10 20 40 / 0.6)",
      }}
      role="img"
      aria-label={`${book.title}, de ${book.author}`}
    >
      <svg viewBox="0 0 100 150" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <Motif motif={book.motif} color={book.accent} />
      </svg>
      {showText && (
        <div className="absolute inset-0 flex flex-col justify-between p-[9%]">
          <p
            lang="pt-BR"
            className="font-display font-semibold leading-[1.08] [hyphens:auto] [overflow-wrap:anywhere]"
            style={{ fontSize: "clamp(0.55rem, 12.5cqw, 1.5rem)" }}
          >
            {book.title}
          </p>
          <p
            className="font-medium uppercase leading-tight tracking-[0.12em] opacity-80"
            style={{ fontSize: "clamp(0.4rem, 6.5cqw, 0.62rem)" }}
          >
            {book.author}
          </p>
        </div>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(105deg, rgb(255 255 255 / 0.14), transparent 38%)" }}
      />
    </div>
  );
}

/** A stable, good-looking typographic cover for any title without art. */
export function fauxBookFor(title: string, author = ""): FauxBook {
  let hash = 0;
  for (const ch of title + author) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const base = FAUX_BOOKS[Math.abs(hash) % FAUX_BOOKS.length]!;
  return { ...base, title, author: author || "Autor desconhecido" };
}
