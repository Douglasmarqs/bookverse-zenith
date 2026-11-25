import { Link } from "@tanstack/react-router";
import { Check, FileText, X } from "lucide-react";
import { motion } from "motion/react";

import { formatBytes } from "@/lib/device-books";
import { KIND_LABEL } from "@/lib/importers";
import { dismissImport, type ImportItem } from "@/lib/import-queue";

/** One file in the import queue — mockup P1 "Importando agora". */
export function ImportCard({ item }: { item: ImportItem }) {
  const done = item.status === "done";
  const error = item.status === "error";
  const pct = Math.round(item.progress * 100);
  const meta = [
    item.kind ? KIND_LABEL[item.kind] : "Arquivo",
    formatBytes(item.bytes),
    item.pages ? `${item.pages} págs.` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="surface-card list-none rounded-[18px] px-3.5 py-3"
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-12 w-[38px] shrink-0 place-items-center rounded-[6px] ${
            done
              ? "bg-mint text-[#1f6b46]"
              : error
                ? "bg-rose text-[#9a1f45]"
                : "bg-surface-2 text-muted-foreground"
          }`}
        >
          {done ? (
            <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
          ) : error ? (
            <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
          ) : (
            <FileText className="h-[18px] w-[18px]" strokeWidth={2.2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{item.name}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-faint">{meta}</p>
        </div>
        {done && item.readerId ? (
          <Link
            to="/reader/$bookId"
            params={{ bookId: item.readerId }}
            className="press inline-flex h-[34px] shrink-0 items-center rounded-full bg-foreground px-3.5 text-[13px] font-semibold text-background"
          >
            Ler
          </Link>
        ) : error ? (
          <button
            type="button"
            onClick={() => dismissImport(item.id)}
            aria-label="Remover da lista"
            className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="num shrink-0 text-[12.5px] font-semibold text-muted-foreground">
            {item.status === "waiting" ? "na fila" : `${pct}%`}
          </span>
        )}
      </div>
      {!done && !error && (
        <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-accent-soft">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-300"
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        </div>
      )}
      <p className={`mt-2 text-[12px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
        {error ? item.error : item.stage}
      </p>
    </motion.li>
  );
}
