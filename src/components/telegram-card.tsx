import { Send, ArrowUpRight } from "lucide-react";
import { TELEGRAM_CHANNEL_URL } from "@/lib/editorial";

/** Convite para o canal de leitores no Telegram, com o fluxo prático de
 * "baixar EPUB lá → importar aqui" — é o principal caminho de entrada de
 * livros no app, então vale explicar em três passos. */
export function TelegramCard({ compact = false }: { compact?: boolean }) {
  if (!TELEGRAM_CHANNEL_URL) return null;

  return (
    <section className="glass-plate mt-10 overflow-hidden rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Comunidade</p>
          <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">
            Chat de leitores e troca de EPUBs
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Indicações, clubes de leitura e um acervo de arquivos <code>.epub</code> para você
            importar direto no BookVerse.
          </p>
        </div>
        <a
          href={TELEGRAM_CHANNEL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Send className="h-4 w-4" />
          Entrar no canal
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {!compact && (
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            "Abra o canal e baixe o arquivo .epub do livro que quiser.",
            'Volte aqui e toque em "Adicionar EPUB" na sua biblioteca.',
            "Pronto: o livro abre no leitor e o progresso sincroniza entre seus aparelhos.",
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
