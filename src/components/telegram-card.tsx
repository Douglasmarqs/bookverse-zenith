import { ArrowUpRight, BookOpenCheck, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * The previous version sent people to a Telegram channel described only as
 * an EPUB archive. It did not state who owns each file or which licences
 * apply, so it cannot be presented as a BookVerse acquisition source.
 *
 * Keep the component name for existing route imports, but turn it into a
 * useful, legal path: full public-domain reading in the app and an official
 * source page for a person who chooses to download a permitted EPUB.
 */
export function TelegramCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className="glass-plate mt-10 overflow-hidden rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
            <ShieldCheck className="h-3.5 w-3.5" /> Fonte autorizada
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">
            Clássicos gratuitos, com origem clara
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Explore obras de domínio público no leitor do BookVerse. Se preferir um arquivo EPUB,
            use o catálogo oficial e confira os direitos aplicáveis no seu país.
          </p>
        </div>
        <Link
          to="/descobrir"
          search={{ q: undefined, categoria: "Clássicos" }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <BookOpenCheck className="h-4 w-4" />
          Ler clássicos
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!compact && (
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            "Abra um clássico de domínio público direto no BookVerse.",
            "Se você já possui um EPUB autorizado, importe-o na sua biblioteca.",
            "O progresso e suas anotações acompanham a sua conta em outros aparelhos.",
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
