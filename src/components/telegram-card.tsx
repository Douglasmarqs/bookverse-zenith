import { ArrowUpRight, BookOpenCheck, FileText, Send } from "lucide-react";
import { BAIXE_LIVROS_URL, TELEGRAM_CHANNEL_URL } from "@/lib/editorial";

export function TelegramCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className="glass-plate mt-10 overflow-hidden rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
            <BookOpenCheck className="h-3.5 w-3.5" /> EPUBs
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">
            Escolha onde procurar seu próximo livro
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Encontre EPUBs pelo Telegram, clássicos na fonte oficial ou arquivos em PDF no Baixe
            Livros.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={TELEGRAM_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Send className="h-4 w-4" />
            Abrir Telegram
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://www.gutenberg.org/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition hover:border-gold/45 hover:text-gold"
          >
            Fonte oficial
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            href={BAIXE_LIVROS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-5 py-3 text-sm font-medium text-blue-700 transition hover:border-blue-400 hover:bg-blue-100"
          >
            <FileText className="h-4 w-4" />
            Procurar PDFs
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {!compact && (
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            "Escolha o canal do Telegram para ver EPUBs compartilhados.",
            "Use a fonte oficial para explorar clássicos de domínio público.",
            "Procure PDFs e importe EPUB ou PDF na biblioteca para começar a ler.",
          ].map((step, i) => (
            <li
              key={i}
              className="rounded-2xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground"
            >
              <span className="mb-2 inline-grid h-6 w-6 place-items-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
                {i + 1}
              </span>
              <p className="leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
