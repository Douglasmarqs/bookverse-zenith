/**
 * "Estante" — the library as a real bookcase. Books stand face-out on
 * wooden shelves, each with a library label telling its format (EPUB,
 * PDF…) and where it came from, a ribbon bookmark for how far you've read
 * and a seal on the ones you finished.
 *
 * Touch: a book rises off the shelf under your finger, is pulled out when
 * you tap (then opens), wobbles on a long press (options). Books drop onto
 * the shelves when it appears and sway with scroll. Lumi keeps watch at
 * the end of the last shelf. Everything moves with transform/opacity only,
 * so it runs on the compositor.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check } from "lucide-react";

import { BookArt } from "@/components/book-art";
import { Lumi } from "@/components/brand/lumi";
import { coverIn, playBookOpen } from "@/lib/book-motion";
import type { DeviceKind } from "@/lib/device-books";
import { bookFormat } from "@/lib/book-format";
import { languageLabel } from "@/lib/public-domain";

export interface ShelfItem {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
  readerId?: string | null;
  status: string;
  progress: number;
  device?: { kind: DeviceKind; origin: "catalogo" | "arquivo" };
  /** "pt", "en"… when known. */
  language?: string | null;
}

const LANG_TONE: Record<string, string> = {
  pt: "#1c7a4a",
  en: "#2b4f99",
  es: "#a0522d",
  fr: "#6b4fa0",
};

/** Small deterministic variety so the shelf doesn't look like a grid. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function useColumns(ref: React.RefObject<HTMLElement | null>) {
  const [cols, setCols] = useState(3);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pick = (w: number) => (w < 520 ? 3 : w < 760 ? 4 : w < 1000 ? 5 : 6);
    setCols(pick(el.clientWidth));
    const ro = new ResizeObserver(([e]) => {
      const next = pick(e!.contentRect.width);
      setCols((c) => (c === next ? c : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

export function Bookshelf({
  books,
  label,
  onOpen,
  onMore,
}: {
  books: ShelfItem[];
  /** Brass plaque on top of the bookcase. */
  label: string;
  onOpen: (b: ShelfItem) => void;
  onMore: (b: ShelfItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cols = useColumns(ref);
  const rows = useMemo(() => {
    const out: ShelfItem[][] = [];
    for (let i = 0; i < books.length; i += cols) out.push(books.slice(i, i + cols));
    return out;
  }, [books, cols]);
  const lastRowFree = rows.length ? cols - rows[rows.length - 1]!.length : 0;

  return (
    <div ref={ref} className="bookcase mx-3 mt-4 lg:mx-4">
      <div className="bookcase-plaque">
        <span>{label}</span>
      </div>
      {rows.map((row, r) => (
        <div key={r} className="bookcase-row">
          <ul
            className="bookcase-books"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {row.map((b, i) => (
              <ShelfBook
                key={b.id}
                book={b}
                order={r * cols + i}
                onOpen={() => onOpen(b)}
                onMore={() => onMore(b)}
              />
            ))}
            {r === rows.length - 1 && lastRowFree > 0 && (
              <li
                aria-hidden
                className="bookcase-lumi"
                style={{ gridColumn: `span ${lastRowFree}` }}
              >
                <Lumi pose="idle" size={lastRowFree > 1 ? 86 : 64} shadow={false} />
              </li>
            )}
          </ul>
          <div aria-hidden className="bookcase-plank" />
        </div>
      ))}
    </div>
  );
}

function ShelfBook({
  book,
  order,
  onOpen,
  onMore,
}: {
  book: ShelfItem;
  order: number;
  onOpen: () => void;
  onMore: () => void;
}) {
  const li = useRef<HTMLLIElement>(null);
  const press = useRef<{ t: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const fmt = bookFormat(book);
  const h = hash(book.id);
  // Books aren't all the same height, nor perfectly straight.
  const vars = {
    "--h": (0.9 + h * 0.1).toFixed(3),
    "--lean": `${((h - 0.5) * 2.4).toFixed(2)}deg`,
    "--d": `${Math.min(order, 14) * 45}ms`,
  } as CSSProperties;
  const reading = book.status !== "concluido" && book.progress > 0.01;
  const done = book.status === "concluido";

  useEffect(() => () => clearTimeout(press.current?.t), []);

  const set = (state: string | null) => {
    const el = li.current;
    if (!el) return;
    if (state) el.dataset.state = state;
    else delete el.dataset.state;
  };

  return (
    <li ref={li} className="shelf-book" style={vars}>
      <button
        type="button"
        aria-label={`${book.title}, ${book.author} · ${fmt.label}${book.language ? ` · ${languageLabel(book.language)}` : ""} · ${fmt.origin}${reading ? ` · ${Math.round(book.progress * 100)}% lido` : done ? " · lido" : ""}`}
        className="shelf-book-btn [-webkit-touch-callout:none]"
        onPointerDown={() => {
          set("lift");
          const t = setTimeout(() => {
            if (!press.current) return;
            press.current.fired = true;
            set("wobble");
            navigator.vibrate?.(12);
            onMore();
          }, 480);
          press.current = { t, fired: false };
        }}
        onPointerUp={() => {
          clearTimeout(press.current?.t);
          // A drag or scroll ends without a click: let the book settle back.
          setTimeout(() => {
            if (li.current?.dataset.state === "lift") set(null);
          }, 260);
        }}
        onPointerLeave={() => {
          clearTimeout(press.current?.t);
          if (li.current?.dataset.state === "lift") set(null);
        }}
        onPointerCancel={() => {
          clearTimeout(press.current?.t);
          set(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          const fired = press.current?.fired;
          press.current = null;
          if (fired) {
            setTimeout(() => set(null), 420);
            return;
          }
          // Pulled off the shelf, then it opens.
          set("pull");
          const cover = coverIn(e.currentTarget);
          setTimeout(() => {
            if (book.readerId) playBookOpen(cover);
            onOpen();
            setTimeout(() => set(null), 400);
          }, 170);
        }}
      >
        <span className="shelf-book-body">
          <BookArt title={book.title} author={book.author} cover={book.cover} live />
          <span className="shelf-tags">
            <span
              className="shelf-label"
              style={{ "--tone": fmt.tone } as CSSProperties}
              title={`${fmt.label} · ${fmt.origin}`}
            >
              {fmt.label === "ONLINE" ? "Online" : fmt.label === "SALVO" ? "Lista" : fmt.label}
            </span>
            {book.language && (
              <span
                className="shelf-label"
                style={{ "--tone": LANG_TONE[book.language] ?? "#5b6270" } as CSSProperties}
                title={`Idioma: ${languageLabel(book.language)}`}
              >
                {book.language.toUpperCase()}
              </span>
            )}
          </span>
          {reading && (
            <span
              aria-hidden
              className="shelf-ribbon"
              style={{ "--p": Math.max(0.18, book.progress).toFixed(3) } as CSSProperties}
            />
          )}
          {done && (
            <span aria-hidden className="shelf-seal">
              <Check className="h-3 w-3" strokeWidth={3.2} />
            </span>
          )}
        </span>
      </button>
      <p className="shelf-caption">
        {reading ? `${Math.round(book.progress * 100)}% · ` : done ? "Lido · " : ""}
        {fmt.origin}
      </p>
    </li>
  );
}
