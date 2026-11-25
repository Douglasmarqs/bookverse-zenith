import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BookArt } from "@/components/book-art";
import { ImportCard } from "@/components/import/import-card";
import { forgetDownloadedReaderId } from "@/lib/catalog";
import { forgetDeviceBook, formatBytes, useDeviceBooks, type DeviceBook } from "@/lib/device-books";
import { KIND_LABEL } from "@/lib/importers";
import { clearFinishedImports, useImportQueue } from "@/lib/import-queue";
import { setPdfMode, usePdfMode, type PdfMode } from "@/lib/pdf-mode";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads e arquivos — BookVerse" },
      {
        name: "description",
        content: "Livros salvos neste aparelho, importações em andamento e como abrir PDFs.",
      },
    ],
  }),
  component: DownloadsPage,
});

const KIND_COLOR = { pdf: "#ff4d1a", epub: "#6d5df6", outros: "#17867a" } as const;

function DownloadsPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const books = useDeviceBooks();
  const queue = useImportQueue();
  const pdfMode = usePdfMode();
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((e) => setQuota({ usage: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => {});
  }, [books.length]);

  const split = useMemo(() => {
    const out = { pdf: 0, epub: 0, outros: 0 };
    for (const b of books) {
      if (b.kind === "pdf") out.pdf += b.bytes;
      else if (b.kind === "epub") out.epub += b.bytes;
      else out.outros += b.bytes;
    }
    return out;
  }, [books]);

  const used = Math.max(quota?.usage ?? 0, split.pdf + split.epub + split.outros);
  const total = quota?.quota ?? 0;
  const pct = (n: number) => (total ? Math.max(n ? 1.5 : 0, Math.min(100, (n / total) * 100)) : 0);

  function close() {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/perfil" });
  }

  return (
    <div className="mx-auto max-w-xl pb-12 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-10">
      <header className="flex items-center justify-between px-4">
        <button
          type="button"
          onClick={close}
          aria-label="Voltar"
          className="press grid h-[42px] w-[42px] place-items-center rounded-full"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="font-sans text-base font-bold tracking-normal">Downloads e arquivos</h1>
        <Link
          to="/adicionar"
          search={{}}
          aria-label="Adicionar livros"
          className="press inline-flex h-[38px] items-center gap-1 rounded-full bg-surface-2 pl-2.5 pr-3.5 text-[13.5px] font-semibold"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
          Adicionar
        </Link>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card mx-4 mt-3 p-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14.5px] font-bold">Neste aparelho</p>
          <p className="num text-[12.5px] text-muted-foreground">
            {formatBytes(used)}
            {total ? ` de ${formatBytes(total)}` : ""}
          </p>
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-[6px] bg-surface-2">
          {(["pdf", "epub", "outros"] as const).map((k) => (
            <i
              key={k}
              className="block h-full transition-[width] duration-500"
              style={{ width: `${pct(split[k])}%`, background: KIND_COLOR[k] }}
            />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] font-semibold text-muted-foreground">
          {(
            [
              ["pdf", "PDF"],
              ["epub", "EPUB"],
              ["outros", "Outros"],
            ] as const
          ).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-[2px]" style={{ background: KIND_COLOR[k] }} />
              {label} {formatBytes(split[k])}
            </span>
          ))}
        </div>
      </motion.section>

      {queue.length > 0 && (
        <section>
          <div className="mx-[22px] mb-2 mt-[18px] flex items-baseline justify-between">
            <p className="eyebrow">Importando agora</p>
            {queue.some((i) => i.status === "done" || i.status === "error") && (
              <button
                type="button"
                onClick={clearFinishedImports}
                className="text-[12px] font-semibold text-faint"
              >
                Limpar prontos
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-2 px-4">
            <AnimatePresence initial={false}>
              {queue.map((item) => (
                <ImportCard key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <section className="surface-card mx-4 mt-3 px-4 py-3.5">
        <p className="text-[14.5px] font-bold">Como ler PDFs</p>
        <div
          role="radiogroup"
          aria-label="Como ler PDFs"
          className="mt-2.5 flex rounded-[14px] bg-surface-2 p-1"
        >
          {(
            [
              ["original", "Página original"],
              ["leitura", "Modo leitura"],
            ] as [PdfMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={pdfMode === mode}
              onClick={() => setPdfMode(mode)}
              className={`h-9 flex-1 rounded-[11px] text-[13px] font-semibold transition ${
                pdfMode === mode
                  ? "bg-card text-foreground shadow-[0_2px_6px_rgba(0,0,0,.08)]"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-faint">
          {pdfMode === "leitura"
            ? "Modo leitura reflui o texto: muda fonte e tamanho, vira página igual a um EPUB."
            : "Página original mostra o PDF como foi feito — ideal para apostilas com tabelas e figuras."}
        </p>
      </section>

      <section className="mt-[18px]">
        <p className="eyebrow mx-[22px] mb-2">Salvos para ler offline</p>
        {books.length ? (
          <ul className="surface-card mx-4 px-3.5 py-1">
            <AnimatePresence initial={false}>
              {books.map((b, i) => (
                <DeviceRow key={b.id} book={b} last={i === books.length - 1} />
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="surface-card mx-4 px-4 py-5 text-center">
            <p className="text-[14px] font-semibold">Nada salvo neste aparelho ainda</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Baixe um clássico grátis ou importe seus arquivos.
            </p>
            <div className="mt-3.5 flex justify-center gap-2">
              <Link
                to="/descobrir"
                search={{}}
                className="press inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-background"
              >
                Explorar grátis
              </Link>
              <Link
                to="/adicionar"
                search={{}}
                className="press inline-flex h-9 items-center rounded-full bg-surface-2 px-4 text-[13px] font-semibold"
              >
                Importar
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function DeviceRow({ book, last }: { book: DeviceBook; last: boolean }) {
  const [confirm, setConfirm] = useState(false);

  async function remove() {
    try {
      if (book.kind === "pdf") {
        const { deletePdfBook } = await import("@/lib/pdf-store");
        await deletePdfBook(book.id);
      } else {
        const { deleteEpubBook } = await import("@/lib/epub-store");
        await deleteEpubBook(book.id);
      }
      forgetDeviceBook(book.id);
      forgetDownloadedReaderId(book.id);
      toast.success("Removido deste aparelho");
    } catch {
      toast.error("Não foi possível remover agora.");
    }
  }

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0 }}
      className={`flex items-center gap-3 py-2.5 ${last ? "" : "border-b border-border"}`}
    >
      <div className="w-[34px] shrink-0">
        <BookArt title={book.title} author={book.author} showText={false} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{book.title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-faint">
          {KIND_LABEL[book.kind]} · {formatBytes(book.bytes)}
          {book.pages ? ` · ${book.pages} págs.` : ""}
          {book.origin === "catalogo" ? " · grátis" : ""}
        </p>
      </div>
      {confirm ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="h-8 rounded-full px-2.5 text-[12.5px] font-semibold text-muted-foreground"
          >
            Manter
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="press h-8 rounded-full bg-destructive px-3 text-[12.5px] font-semibold text-white"
          >
            Remover
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label={`Remover ${book.title} deste aparelho`}
            className="press grid h-8 w-8 place-items-center rounded-full text-faint"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <Link
            to="/reader/$bookId"
            params={{ bookId: book.id }}
            className="press inline-flex h-[34px] items-center rounded-full bg-foreground px-3.5 text-[13px] font-semibold text-background"
          >
            Ler
          </Link>
        </div>
      )}
    </motion.li>
  );
}
