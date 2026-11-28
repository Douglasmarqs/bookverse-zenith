import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { BookOpen, Headphones, X } from "lucide-react";

import { FauxCover } from "@/components/faux-cover";
import { haptic } from "@/components/motion/interactive";
import { bookPalette, fauxBookFor } from "@/lib/faux-books";
import { useLastBook } from "@/lib/nav";

/**
 * "Lendo agora" — the book you're reading, one tap away from every screen
 * (like a music player's now-playing bar). It wears the book's colours.
 */
const HIDDEN_KEY = "bookverse:mini-hidden";

/** Dismissed until the next time a book is opened (its updatedAt moves on). */
function useHiddenUntil(): [number, (v: number) => void] {
  const [hidden, setHidden] = useState(0);
  useEffect(() => {
    try {
      setHidden(Number(localStorage.getItem(HIDDEN_KEY) ?? 0));
    } catch {
      // ignore
    }
  }, []);
  const set = (v: number) => {
    setHidden(v);
    try {
      localStorage.setItem(HIDDEN_KEY, String(v));
    } catch {
      // ignore
    }
  };
  return [hidden, set];
}

export function MiniPlayer({ compact = false }: { compact?: boolean }) {
  const last = useLastBook();
  const [hiddenUntil, setHiddenUntil] = useHiddenUntil();
  // Only after listening ("Ouvir") and leaving the book — not every time a
  // book was opened.
  const book = last && last.listened && (last.updatedAt ?? 1) > hiddenUntil ? last : null;
  const dismiss = () => {
    haptic(8);
    setHiddenUntil(last?.updatedAt ?? Date.now());
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  };
  const navigate = useNavigate();
  const title = book?.title ?? "Continuar leitura";
  const pal = bookPalette(title, book?.author);
  const subtitle =
    [
      book?.chapter,
      book?.chapterMinutesLeft != null
        ? `${Math.max(1, Math.round(book.chapterMinutesLeft))} min p/ terminar`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") ||
    book?.author ||
    "Toque para voltar à página";
  const pct = Math.round((book?.progress ?? 0) * 100);

  if (compact) {
    return (
      <AnimatePresence initial={false}>
        {book && (
          <motion.div
            key="mini-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="relative overflow-hidden rounded-[20px] p-3 shadow-[0_18px_36px_-22px_rgb(0_0_0/0.6)]"
            style={{ background: pal.bg, color: pal.fg }}
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-70">
              Lendo agora
            </p>
            <div className="flex gap-3">
              <Link
                to="/reader/$bookId"
                params={{ bookId: book.id }}
                aria-hidden
                tabIndex={-1}
                className="w-[44px] shrink-0 overflow-hidden rounded-[3px_5px_5px_3px] shadow-[0_6px_14px_rgb(0_0_0/0.35)]"
              >
                {book.cover ? (
                  <img src={book.cover} alt="" className="aspect-[2/3] w-full object-cover" />
                ) : (
                  <FauxCover book={fauxBookFor(title, book.author)} showText={false} />
                )}
              </Link>
              <div className="min-w-0 flex-1 pr-5">
                <p className="line-clamp-2 text-[14px] font-[680] leading-snug tracking-[-0.01em]">
                  {title}
                </p>
                <p className="mt-0.5 truncate text-[12px] opacity-70">{subtitle}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="h-1 flex-1 overflow-hidden rounded-full"
                style={{ background: "color-mix(in srgb, currentColor 20%, transparent)" }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${pct}%`, background: pal.accent }}
                />
              </span>
              <span className="text-[11px] font-semibold tabular-nums opacity-80">{pct}%</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                to="/reader/$bookId"
                params={{ bookId: book.id }}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-semibold transition hover:opacity-90"
                style={{ background: pal.fg, color: pal.bg }}
              >
                <BookOpen className="h-4 w-4" /> Continuar
              </Link>
              <button
                type="button"
                aria-label="Ouvir"
                title="Ouvir"
                onClick={() =>
                  void navigate({
                    to: "/reader/$bookId",
                    params: { bookId: book.id },
                    search: { ouvir: 1 } as never,
                  })
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:opacity-90"
                style={{ background: "color-mix(in srgb, currentColor 16%, transparent)" }}
              >
                <Headphones className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              aria-label="Fechar Lendo agora"
              title="Fechar"
              onClick={dismiss}
              className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full opacity-60 transition hover:opacity-100"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {book && (
        <motion.div
          key="mini"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          drag={compact ? false : "x"}
          dragSnapToOrigin
          dragElastic={0.5}
          onDragEnd={(_, i) => {
            if (Math.abs(i.offset.x) > 110 || Math.abs(i.velocity.x) > 700) dismiss();
          }}
          whileTap={{ scale: 0.985 }}
          className="vt-mini relative flex h-[62px] touch-pan-y items-center gap-2.5 overflow-hidden rounded-[22px] pl-3 pr-2 shadow-[0_18px_36px_-18px_rgb(0_0_0/0.55)]"
          style={{ background: pal.bg, color: pal.fg }}
        >
          <Link
            to="/reader/$bookId"
            params={{ bookId: book.id }}
            onClick={() => haptic(6)}
            className="absolute inset-0"
            aria-label={`Continuar lendo ${title}`}
          />
          <div className="pointer-events-none w-[34px] shrink-0 overflow-hidden rounded-[3px_5px_5px_3px] shadow-[0_4px_10px_rgb(0_0_0/0.35)]">
            {book.cover ? (
              <img src={book.cover} alt="" className="aspect-[2/3] w-full object-cover" />
            ) : (
              <FauxCover book={fauxBookFor(title, book.author)} showText={false} />
            )}
          </div>
          <div className="pointer-events-none min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-[680] leading-tight tracking-[-0.01em]">
              {title}
            </p>
            <p className="mt-1 truncate text-xs opacity-70">{subtitle}</p>
          </div>
          {!compact && (
            <button
              type="button"
              aria-label="Ouvir"
              onClick={() => {
                haptic(6);
                void navigate({
                  to: "/reader/$bookId",
                  params: { bookId: book.id },
                  search: { ouvir: 1 } as never,
                });
              }}
              className="press relative grid h-[42px] w-[42px] place-items-center rounded-full"
            >
              <Headphones className="h-[19px] w-[19px]" />
            </button>
          )}
          <Link
            to="/reader/$bookId"
            params={{ bookId: book.id }}
            onClick={() => haptic(6)}
            aria-label="Abrir o livro"
            className="press relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full"
            style={{ background: pal.fg, color: pal.bg }}
          >
            <BookOpen className="h-[19px] w-[19px]" strokeWidth={2.1} />
          </Link>
          <button
            type="button"
            aria-label="Fechar barra Lendo agora"
            onClick={dismiss}
            className="press relative -mr-0.5 grid h-[34px] w-[30px] shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100"
          >
            <X className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
          <i
            className="pointer-events-none absolute bottom-0 left-0 h-[3px]"
            style={{ width: `${pct}%`, background: pal.accent }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
