/**
 * Visão geral — Kindle's "Page Flip": the page shrinks into a strip of the
 * chapter's pages so you can look around and jump, or go back to exactly
 * where you were. Pages are cut from a snapshot of the rendered chapter.
 */
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface Props {
  snapshot: string;
  pageWidth: number;
  columnWidth: number;
  padding: string;
  pageCount: number;
  current: number;
  bg: string;
  fg: string;
  label: string;
  progress: number;
  onPick: (index: number) => void;
  onClose: () => void;
}

const SCALE = 0.42;

export function PageOverview({
  snapshot,
  pageWidth,
  columnWidth,
  padding,
  pageCount,
  current,
  bg,
  fg,
  label,
  progress,
  onPick,
  onClose,
}: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const height = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = pageWidth * SCALE;
  const cardH = height * SCALE;

  useEffect(() => {
    const el = strip.current?.children[current] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: "center", block: "nearest" });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, onClose]);

  return (
    <motion.div
      data-reader-action="true"
      role="dialog"
      aria-label="Visão geral das páginas"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[75] flex flex-col bg-[#2a2a2e] text-white"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="rounded-full bg-[#141416] px-3.5 py-1.5 text-[12.5px] font-semibold">
          Visão geral
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center">
        <div
          ref={strip}
          className="no-scrollbar flex w-full snap-x snap-mandatory items-center gap-6 overflow-x-auto px-[calc(50vw-var(--w)/2)] py-6"
          style={{ ["--w" as string]: `${cardW}px` }}
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              initial={i === current ? { scale: (1 / SCALE) * 0.9 } : { opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              aria-label={`Página ${i + 1}`}
              className="relative shrink-0 snap-center overflow-hidden rounded-[14px] shadow-[0_20px_40px_-10px_rgba(0,0,0,.5)]"
              style={{
                width: cardW,
                height: cardH,
                background: bg,
                color: fg,
                outline: i === current ? "3px solid #ff4d1a" : "none",
              }}
            >
              <div
                className="pointer-events-none absolute left-0 top-0 origin-top-left"
                style={{ width: pageWidth, height, transform: `scale(${SCALE})` }}
              >
                <div
                  style={{
                    width: `${pageWidth}px`,
                    height: "100%",
                    columnWidth: `${columnWidth}px`,
                    columnGap: "0px",
                    columnFill: "auto",
                    padding,
                    boxSizing: "border-box",
                    transform: `translateX(${-i * pageWidth}px)`,
                  }}
                  dangerouslySetInnerHTML={{ __html: snapshot }}
                />
              </div>
              <span className="absolute bottom-2 right-2.5 text-[10px] font-semibold opacity-60">
                {i + 1}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
      <div className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
        <button
          type="button"
          onClick={() => onPick(current)}
          className="inline-flex h-11 items-center rounded-full bg-[#ff4d1a] px-[18px] text-sm font-semibold"
        >
          Voltar à página {current + 1}
        </button>
        <div className="mx-auto mt-3.5 h-1 max-w-md overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold text-[#cfcfca]">{label}</p>
      </div>
    </motion.div>
  );
}
