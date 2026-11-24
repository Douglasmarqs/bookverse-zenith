import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Headphones } from "lucide-react";

import { FauxCover } from "@/components/faux-cover";
import { haptic } from "@/components/motion/interactive";
import { bookPalette, fauxBookFor } from "@/lib/faux-books";
import { useLastBook } from "@/lib/nav";

/**
 * "Lendo agora" — the book you're reading, one tap away from every screen
 * (like a music player's now-playing bar). It wears the book's colours.
 */
export function MiniPlayer({ compact = false }: { compact?: boolean }) {
  const book = useLastBook();
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

  return (
    <AnimatePresence initial={false}>
      {book && (
        <motion.div
          key="mini"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="relative flex h-[62px] items-center gap-3 overflow-hidden rounded-[22px] pl-3 pr-2 shadow-[0_18px_36px_-18px_rgb(0_0_0/0.55)]"
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
          <i
            className="pointer-events-none absolute bottom-0 left-0 h-[3px]"
            style={{ width: `${pct}%`, background: pal.accent }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
