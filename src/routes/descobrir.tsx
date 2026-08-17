import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Check,
  Loader2,
  BookOpenCheck,
  Sparkles,
  Quote,
  Clock,
  Compass,
  Send,
  Flame,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { describeFirestoreError } from "@/lib/async-utils";
import {
  searchPublicDomainBooks,
  gutenbergReaderId,
  type PublicDomainSummary,
} from "@/lib/public-domain";
import { addToLibrary } from "@/lib/library";
import { LanguageBadge } from "@/components/language-badge";
import { BookGridSkeleton } from "@/components/book-grid-skeleton";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  CURIOSITIES,
  LUMI_PICKS,
  READING_TRACKS,
  RITUALS,
  TELEGRAM_CHANNEL_URL,
  rotate,
} from "@/lib/editorial";

const CATEGORIES = [
  "Clássicos",
  "Ficção científica",
  "Poesia",
  "Terror",
  "Filosofia",
  "Aventura",
  "Contos",
  "Mistério",
];

const DEFAULT_QUERY = "clássicos da literatura";

export const Route = createFileRoute("/descobrir")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Descobrir livros para ler agora — BookVerse" },
      {
        name: "description",
        content:
          "Indicações comentadas pela Lumi, curiosidades literárias, rituais de leitura e clássicos de domínio público que abrem direto no leitor.",
      },
      { property: "og:title", content: "Descobrir livros para ler agora — BookVerse" },
      {
        property: "og:description",
        content: "Curadoria comentada, trilhas de leitura e clássicos completos para ler no app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DescobrirPage,
});

function DescobrirPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const user = useAuthUser();
  const [query, setQuery] = useState(search.q ?? "");
  const [books, setBooks] = useState<PublicDomainSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [curiosity, setCuriosity] = useState(0);

  const picks = useMemo(() => rotate(LUMI_PICKS, 3), []);
  const rituals = useMemo(() => rotate(RITUALS, 4), []);

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    setCuriosity(Math.floor(Math.random() * CURIOSITIES.length));
    const t = setInterval(() => setCuriosity((n) => (n + 1) % CURIOSITIES.length), 11000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const effectiveQuery = search.q ?? search.categoria ?? DEFAULT_QUERY;
    searchPublicDomainBooks(effectiveQuery, 12)
      .then((r) => {
        if (!cancelled) setBooks(r);
      })
      .catch(() => {
        if (!cancelled) setBooks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search.q, search.categoria]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/descobrir", search: { q: query || undefined, categoria: search.categoria } });
  }

  async function handleSave(book: { id: number; title: string; author: string; cover: string | null }) {
    if (!user || user.isAnonymous) {
      navigate({ to: "/auth", search: { redirect: "/descobrir" } });
      return;
    }
    if (saving.has(book.id)) return;
    setSaving((s) => new Set(s).add(book.id));
    try {
      await addToLibrary(
        user.uid,
        {
          title: book.title,
          author: book.author,
          cover: book.cover,
          readerId: gutenbergReaderId(book.id),
        },
        "quero-ler",
      );
      setAdded((s) => new Set(s).add(book.id));
      toast.success("Salvo na sua biblioteca.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar este livro agora."));
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(book.id);
        return next;
      });
    }
  }

  const fact = CURIOSITIES[curiosity] ?? CURIOSITIES[0]!;

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-7 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
            <Compass className="h-3.5 w-3.5" /> Descobrir
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-tight md:text-5xl">
            Curadoria comentada, não uma vitrine de capas
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Tudo o que aparece aqui é lido dentro do app: texto completo, tipografia ajustável,
            marcações e progresso sincronizado. A Lumi comenta cada indicação como quem já leu.
          </p>

          <form onSubmit={runSearch} className="mt-7 flex max-w-xl items-center gap-2">
            <div className="flex flex-1 items-center gap-3 rounded-full border border-border bg-secondary/40 px-4 py-3 transition-colors focus-within:border-gold/60">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título, autor, tema…"
                aria-label="Buscar livros"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Buscar
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {CATEGORIES.map((c) => {
              const activeC = search.categoria === c;
              return (
                <button
                  key={c}
                  onClick={() =>
                    navigate({
                      to: "/descobrir",
                      search: { q: search.q, categoria: activeC ? undefined : c },
                    })
                  }
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    activeC
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border bg-secondary/30 text-foreground/85 hover:border-gold/40 hover:text-gold"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Indicações da Lumi */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
          <Sparkles className="h-3.5 w-3.5" /> Indicações da Lumi — desta semana
        </div>
        <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">
          Três livros com um porquê
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {picks.map((p) => (
            <article
              key={p.gutenbergId}
              className="flex flex-col rounded-2xl border border-border/60 bg-card/40 p-5 transition-all hover:-translate-y-1 hover:border-gold/40"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Clock className="h-3 w-3" /> {Math.round(p.minutes / 60)}h de leitura · {p.mood}
              </div>
              <h3 className="mt-3 font-display text-lg font-medium leading-snug">{p.title}</h3>
              <p className="text-xs text-muted-foreground">{p.author}</p>
              <div className="mt-4 rounded-xl border border-gold/25 bg-gold/5 p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-gold">
                  <Sparkles className="h-3 w-3" /> Lumi comenta
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/85">{p.lumiNote}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3 pt-1">
                <Link
                  to="/reader/$bookId"
                  params={{ bookId: gutenbergReaderId(p.gutenbergId) }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  <BookOpenCheck className="h-3.5 w-3.5" /> Ler agora
                </Link>
                <button
                  onClick={() =>
                    handleSave({
                      id: p.gutenbergId,
                      title: p.title,
                      author: p.author,
                      cover: null,
                    })
                  }
                  disabled={added.has(p.gutenbergId) || saving.has(p.gutenbergId)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold disabled:opacity-60"
                >
                  {saving.has(p.gutenbergId) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : added.has(p.gutenbergId) ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Salvo
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Salvar
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Curiosidade + rituais */}
      <section className="mt-14 grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 to-card/20 p-6">
          <Quote className="h-5 w-5 text-gold" />
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">{fact.text}</p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {fact.source}
          </p>
          <div className="mt-5 flex gap-1.5">
            {CURIOSITIES.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-5 rounded-full transition-colors ${
                  i === curiosity ? "bg-gold" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
            <Flame className="h-3.5 w-3.5" /> Rituais de leitura
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {rituals.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-border/60 bg-card/30 p-4 transition-colors hover:border-gold/40"
              >
                <p className="font-display text-sm font-medium">{r.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trilhas temáticas */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
          <Target className="h-3.5 w-3.5" /> Trilhas temáticas
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-medium md:text-3xl">
            Desafios com tema, não só números
          </h2>
          <Link to="/desafios" className="shrink-0 text-xs text-gold hover:underline">
            Ver conquistas →
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {READING_TRACKS.map((t) => (
            <div
              key={t.id}
              className="flex flex-col rounded-2xl border border-border/60 bg-card/30 p-5 transition-all hover:-translate-y-1 hover:border-gold/40"
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-gold">+{t.xp} XP</p>
              <p className="mt-2 font-display text-base font-medium leading-snug">{t.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                {t.description}
              </p>
              <Link
                to="/descobrir"
                search={{ q: t.query, categoria: undefined }}
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-gold"
              >
                Começar trilha →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comunidade */}
      <section className="mt-14 overflow-hidden rounded-3xl border border-gold/25 bg-gold/5 p-7 md:flex md:items-center md:justify-between md:gap-8 md:p-9">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
            <Send className="h-3.5 w-3.5" /> Comunidade
          </p>
          <h2 className="mt-3 font-display text-2xl font-medium">
            Chat de leitores e troca de EPUBs no Telegram
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Um canal para indicações, dúvidas sobre o leitor e clubes de leitura mensais.
          </p>
        </div>
        {TELEGRAM_CHANNEL_URL ? (
          <a
            href={TELEGRAM_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground md:mt-0"
          >
            <Send className="h-4 w-4" /> Entrar no canal
          </a>
        ) : (
          <span className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-full border border-gold/40 px-5 py-3 text-sm text-gold md:mt-0">
            Link em breve
          </span>
        )}
      </section>

      {/* Catálogo legível */}
      <section className="mt-14">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
          <BookOpenCheck className="h-3.5 w-3.5" /> Texto completo — abre direto no leitor
        </div>
        <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">
          {search.q || search.categoria ? "Resultados da sua busca" : "Domínio público em destaque"}
        </h2>
        {loading ? (
          <BookGridSkeleton count={8} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        ) : books.length === 0 ? (
          <p className="py-14 text-sm text-muted-foreground">
            Nada encontrado para essa busca. Tente outro termo, autor ou categoria.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((book) => {
              const isAdded = added.has(book.id);
              const isSaving = saving.has(book.id);
              return (
                <div key={book.id} className="group">
                  <Link to="/reader/$bookId" params={{ bookId: gutenbergReaderId(book.id) }}>
                    <div className="relative">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={`Capa de ${book.title}`}
                          loading="lazy"
                          className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform group-hover:-translate-y-1"
                        />
                      ) : (
                        <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center transition-transform group-hover:-translate-y-1">
                          <span className="font-display text-xs text-foreground/70">
                            {book.title}
                          </span>
                        </div>
                      )}
                      <LanguageBadge languages={book.languages} />
                    </div>
                    <p className="mt-3 truncate font-display text-sm font-medium">{book.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
                  </Link>
                  <div className="mt-2 flex items-center gap-2">
                    <Link
                      to="/reader/$bookId"
                      params={{ bookId: gutenbergReaderId(book.id) }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-gold"
                    >
                      <BookOpenCheck className="h-3 w-3" /> Ler agora
                    </Link>
                    <button
                      onClick={() => handleSave(book)}
                      disabled={isAdded || isSaving}
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px] hover:border-gold/40 hover:text-gold disabled:opacity-60"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isAdded ? (
                        <>
                          <Check className="h-3 w-3" /> Salvo
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" /> Salvar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
