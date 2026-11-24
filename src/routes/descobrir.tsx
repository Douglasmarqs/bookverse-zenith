import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FauxCover } from "@/components/faux-cover";
import { Tilt } from "@/components/motion/interactive";
import { fauxBookFor } from "@/lib/faux-books";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  BookOpenText,
  Brain,
  Check,
  Compass,
  Feather,
  Landmark,
  MoonStar,
  Rocket,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { describeFirestoreError } from "@/lib/async-utils";
import { BAIXE_LIVROS_URL, rotate, LUMI_PICKS, TELEGRAM_CHANNEL_URL } from "@/lib/editorial";
import { searchBooks, type BookMeta } from "@/lib/google-books";
import { addToLibrary, slugFor } from "@/lib/library";
import { searchOpenLibrary } from "@/lib/open-library";
import {
  gutenbergReaderId,
  searchPublicDomainBooks,
  type PublicDomainSummary,
} from "@/lib/public-domain";
import { useAuthUser } from "@/hooks/use-auth-user";

const CATEGORIES = ["Clássicos", "Ficção", "Ficção científica", "Poesia", "Filosofia", "Mistério"];

/** Friendlier, mood-first labels for the category shortcuts. */
const MOODS: Record<string, { label: string; icon: typeof Sparkles }> = {
  Clássicos: { label: "Clássicos eternos", icon: Landmark },
  Ficção: { label: "Grandes histórias", icon: BookOpenText },
  "Ficção científica": { label: "Futuros possíveis", icon: Rocket },
  Poesia: { label: "Poesia", icon: Feather },
  Filosofia: { label: "Para pensar", icon: Brain },
  Mistério: { label: "Noite de mistério", icon: MoonStar },
};
const DISCOVERY_THEMES = [
  "adventure",
  "romance",
  "mystery",
  "science",
  "history",
  "poetry",
  "philosophy",
  "short stories",
];
type SourceState = "idle" | "loading" | "ready" | "empty" | "error";

export const Route = createFileRoute("/descobrir")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Descobrir livros — BookVerse" },
      {
        name: "description",
        content: "Pesquise livros reais, salve referências e leia obras legais de domínio público.",
      },
    ],
  }),
  component: DescobrirPage,
});

function DescobrirPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const user = useAuthUser();
  const [query, setQuery] = useState(search.q ?? "");
  const [publicBooks, setPublicBooks] = useState<PublicDomainSummary[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<BookMeta[]>([]);
  const [publicState, setPublicState] = useState<SourceState>("idle");
  const [catalogState, setCatalogState] = useState<SourceState>("idle");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [retryKey, setRetryKey] = useState(0);
  const [curatedOffset, setCuratedOffset] = useState(0);
  const [discoverySeed, setDiscoverySeed] = useState(0);

  const hasSearch = Boolean(search.q?.trim() || search.categoria);
  const discoveryTheme = DISCOVERY_THEMES[discoverySeed % DISCOVERY_THEMES.length]!;
  const effectiveQuery = hasSearch
    ? `${search.q?.trim() ?? ""} ${search.categoria ?? ""}`.trim()
    : discoveryTheme;

  useEffect(() => setQuery(search.q ?? ""), [search.q]);

  useEffect(() => {
    setDiscoverySeed(Math.floor(Date.now() / 86_400_000));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!effectiveQuery) {
      setPublicBooks([]);
      setCatalogBooks([]);
      setPublicState("idle");
      setCatalogState("idle");
      return () => {
        cancelled = true;
      };
    }

    // Keep the current shelf visible while a fresh discovery theme is loading.
    // On slow mobile connections the Cloud Function + direct fallback can take
    // several seconds; clearing here made the whole section appear broken.
    if (hasSearch) setPublicBooks([]);
    setCatalogBooks([]);
    setPublicState("loading");
    setCatalogState(hasSearch ? "loading" : "idle");

    // Every source updates the page independently. A slow provider must not
    // make the complete discovery screen look blank.
    void searchPublicDomainBooks(effectiveQuery, hasSearch ? 12 : 32)
      .then((books) => {
        if (cancelled) return;
        setPublicBooks(hasSearch ? books : rotate(books, 12, discoverySeed * 7));
        setPublicState(books.length ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) setPublicState("error");
      });

    if (hasSearch) {
      void searchOpenLibrary(effectiveQuery, 20)
        .then((books) => {
          if (cancelled) return;
          const results: BookMeta[] = books.map(({ title, author, cover }) => ({
            title,
            author,
            cover,
          }));
          setCatalogBooks(results);
          setCatalogState(results.length ? "ready" : "empty");
        })
        .catch(() => {
          if (!cancelled) setCatalogState("error");
        });

      // Google enriches the catalog in the background; it is deliberately not
      // the gate for the first visible results.
      void searchBooks(search.q?.trim() ?? effectiveQuery, {
        category: search.categoria,
        maxResults: 20,
      })
        .then((result) => {
          if (cancelled || result.results.length === 0) return;
          setCatalogBooks((current) => mergeBooks(current, result.results));
          setCatalogState("ready");
        })
        .catch(() => {
          // Open Library already provides the first result path. A supplementary
          // provider failure must not clear a catalog that is currently visible.
        });
    }

    return () => {
      cancelled = true;
    };
  }, [discoverySeed, effectiveQuery, hasSearch, retryKey, search.categoria, search.q]);

  const curated = useMemo(() => {
    const picks = rotate(LUMI_PICKS, 4, curatedOffset);
    if (!hasSearch) return picks;
    const normalized = effectiveQuery.toLocaleLowerCase("pt-BR");
    return LUMI_PICKS.filter((book) =>
      [book.title, book.author, book.mood, ...book.tags]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    ).slice(0, 4);
  }, [curatedOffset, effectiveQuery, hasSearch]);

  function runSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = query.trim();
    if (next === (search.q ?? "").trim()) {
      setRetryKey((value) => value + 1);
      return;
    }
    navigate({ to: "/descobrir", search: { q: next || undefined, categoria: search.categoria } });
  }

  function clearSearch() {
    setQuery("");
    navigate({ to: "/descobrir", search: { q: undefined, categoria: undefined } });
  }

  async function saveBook(book: BookMeta, key: string, readerId?: string) {
    if (!user || user.isAnonymous) {
      navigate({ to: "/auth", search: { redirect: "/descobrir" } });
      return;
    }
    if (saving.has(key)) return;
    setSaving((current) => new Set(current).add(key));
    try {
      await addToLibrary(user.uid, { ...book, readerId: readerId ?? null }, "quero-ler");
      setAdded((current) => new Set(current).add(key));
      toast.success("Salvo na sua biblioteca.");
    } catch (error) {
      toast.error(describeFirestoreError(error, "Não foi possível salvar este livro agora."));
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <main className="relative mx-auto max-w-[84rem] px-5 py-8 md:px-10 md:py-10">
      <section className="relative">
        <div
          aria-hidden
          className="lamp-glow lamp-breathe pointer-events-none absolute -top-72 left-1/3 h-[40rem] w-[40rem]"
        />
        <div className="relative">
          <p className="eyebrow flex items-center gap-2">
            <Compass className="h-3.5 w-3.5" /> Descobrir · acervo de domínio público e catálogo
          </p>
          <form onSubmit={runSearch} className="group mt-4">
            <label className="flex items-center gap-4 border-b border-border pb-4 transition-colors focus-within:border-gold">
              <Search className="h-7 w-7 shrink-0 text-gold" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="O que você quer ler hoje?"
                aria-label="Buscar livros por título, autor, ISBN ou assunto"
                className="min-w-0 flex-1 bg-transparent font-display text-4xl outline-none placeholder:italic placeholder:text-muted-foreground/70 md:text-6xl"
              />
              <button
                type="submit"
                className="btn-primary hidden shrink-0 sm:inline-flex"
                aria-label="Buscar"
              >
                Buscar <ArrowRight className="h-4 w-4" />
              </button>
            </label>
          </form>
          <p className="mt-3 text-sm text-muted-foreground">
            Título, autor, ISBN ou assunto. Obras de domínio público abrem direto no leitor.
          </p>

          <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
            {CATEGORIES.map((category) => {
              const active = search.categoria === category;
              const mood = MOODS[category] ?? { label: category, icon: Sparkles };
              return (
                <button
                  key={category}
                  onClick={() =>
                    navigate({
                      to: "/descobrir",
                      search: { q: search.q, categoria: active ? undefined : category },
                    })
                  }
                  aria-pressed={active}
                  className={`press inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-border bg-card/50 text-muted-foreground hover:border-gold/45 hover:text-foreground"
                  }`}
                >
                  <mood.icon className="h-4 w-4" /> {mood.label}
                </button>
              );
            })}
            {hasSearch && (
              <button
                onClick={clearSearch}
                className="shrink-0 rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:text-gold"
              >
                Limpar busca
              </button>
            )}
          </div>
        </div>
      </section>

      {!hasSearch ? (
        <section className="mt-12">
          <SectionTitle
            eyebrow="Comece agora"
            title="Leituras que abrem no BookVerse"
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Uma seleção de domínio público renovada diariamente. Use “Trocar seleção” para explorar
            outro tema sem repetir sempre a mesma estante.
          </p>
          <button
            type="button"
            onClick={() => {
              setCuratedOffset((offset) => offset + 4);
              setDiscoverySeed((seed) => seed + 1);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold transition hover:border-gold/50 hover:text-gold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Trocar seleção
          </button>
          <div className="mt-7 grid grid-cols-1 gap-4 transition-all duration-500 sm:grid-cols-2 lg:grid-cols-4">
            {publicBooks.length
              ? rotate(publicBooks, 8, curatedOffset).map((book) => (
                  <PublicBookCard
                    key={book.id}
                    book={book}
                    saving={saving.has(`public-${book.id}`)}
                    added={added.has(`public-${book.id}`)}
                    onSave={() =>
                      saveBook(
                        { title: book.title, author: book.author, cover: book.cover },
                        `public-${book.id}`,
                        gutenbergReaderId(book.id),
                      )
                    }
                  />
                ))
              : curated.map((book) => (
                  <CuratedReadableCard
                    key={book.gutenbergId}
                    book={book}
                    saving={saving.has(`curated-${book.gutenbergId}`)}
                    added={added.has(`curated-${book.gutenbergId}`)}
                    onSave={() =>
                      saveBook(
                        {
                          title: book.title,
                          author: book.author,
                          cover: gutenbergCover(book.gutenbergId),
                        },
                        `curated-${book.gutenbergId}`,
                        gutenbergReaderId(book.gutenbergId),
                      )
                    }
                  />
                ))}
          </div>
        </section>
      ) : (
        <>
          <section className="mt-12">
            <SectionTitle
              eyebrow="Leitura completa"
              title="Disponíveis agora no BookVerse"
              icon={<BookOpenCheck className="h-3.5 w-3.5" />}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Textos de domínio público que você pode abrir sem sair daqui.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {publicBooks.length ? (
                publicBooks.map((book) => (
                  <PublicBookCard
                    key={book.id}
                    book={book}
                    saving={saving.has(`public-${book.id}`)}
                    added={added.has(`public-${book.id}`)}
                    onSave={() =>
                      saveBook(
                        { title: book.title, author: book.author, cover: book.cover },
                        `public-${book.id}`,
                        gutenbergReaderId(book.id),
                      )
                    }
                  />
                ))
              ) : curated.length ? (
                curated.map((book) => (
                  <CuratedReadableCard
                    key={book.gutenbergId}
                    book={book}
                    saving={saving.has(`curated-${book.gutenbergId}`)}
                    added={added.has(`curated-${book.gutenbergId}`)}
                    onSave={() =>
                      saveBook(
                        {
                          title: book.title,
                          author: book.author,
                          cover: gutenbergCover(book.gutenbergId),
                        },
                        `curated-${book.gutenbergId}`,
                        gutenbergReaderId(book.gutenbergId),
                      )
                    }
                  />
                ))
              ) : publicState === "loading" ? (
                <LoadingCards />
              ) : (
                <InlineState
                  state={publicState}
                  empty="Não há uma edição de domínio público correspondente a essa busca."
                  onRetry={() => setRetryKey((value) => value + 1)}
                />
              )}
            </div>
          </section>

          <section className="mt-14 border-t border-border/70 pt-10">
            <SectionTitle
              eyebrow="Catálogo"
              title="Informações e livros para salvar"
              icon={<Search className="h-3.5 w-3.5" />}
            />
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Estes resultados vêm de catálogos bibliográficos. Você pode consultar detalhes e
              salvar na estante; o rótulo deixa claro quando não há leitura no aplicativo.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {catalogBooks.length ? (
                catalogBooks.map((book) => {
                  const key = `catalog-${slugFor(book.title, book.author)}`;
                  return (
                    <CatalogBookCard
                      key={key}
                      book={book}
                      saving={saving.has(key)}
                      added={added.has(key)}
                      onSave={() => saveBook(book, key)}
                    />
                  );
                })
              ) : catalogState === "loading" ? (
                <LoadingCards />
              ) : (
                <InlineState
                  state={catalogState}
                  empty="Nenhum resultado de catálogo para essa busca. Tente título, autor ou ISBN."
                  onRetry={() => setRetryKey((value) => value + 1)}
                />
              )}
            </div>
          </section>
        </>
      )}

      <section className="mt-14 rounded-3xl border border-border/70 bg-secondary/35 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-7">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-medium">Onde encontrar livros</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Escolha o canal do Telegram, consulte clássicos de domínio público ou procure PDFs.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 sm:mt-0">
          <a
            href={TELEGRAM_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Abrir Telegram <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://www.gutenberg.org/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:border-gold/45 hover:text-gold"
          >
            Fonte oficial <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={BAIXE_LIVROS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:border-blue-400 hover:bg-blue-100"
          >
            Procurar PDFs <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    </main>
  );
}

function mergeBooks(current: BookMeta[], incoming: BookMeta[]) {
  const next = [...current];
  const seen = new Set(current.map(bookKey));
  for (const book of incoming) {
    const key = bookKey(book);
    if (!seen.has(key)) {
      seen.add(key);
      next.push(book);
    }
  }
  return next;
}

function bookKey(book: Pick<BookMeta, "title" | "author">) {
  return `${book.title}::${book.author}`.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function gutenbergCover(id: number) {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

function SectionTitle({
  eyebrow,
  title,
  icon,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <header>
      <p className="eyebrow flex items-center gap-2">
        {icon} {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-4xl leading-none md:text-5xl">{title}</h2>
    </header>
  );
}

function CuratedReadableCard({
  book,
  saving,
  added,
  onSave,
}: {
  book: (typeof LUMI_PICKS)[number];
  saving: boolean;
  added: boolean;
  onSave: () => void;
}) {
  const cover = gutenbergCover(book.gutenbergId);
  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-border bg-card/70 p-4 shadow-[0_24px_50px_-40px_rgb(0_0_0/0.8)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-gold/45 hover:shadow-[0_24px_48px_-32px_rgba(126,92,42,0.35)]">
      <Link
        to="/reader/$bookId"
        params={{ bookId: gutenbergReaderId(book.gutenbergId) }}
        className="flex gap-4"
      >
        <BookCover title={book.title} cover={cover} />
        <span className="min-w-0">
          <span className="inline-flex rounded-full bg-gold/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
            Ler agora
          </span>
          <span className="mt-3 block truncate font-display text-2xl leading-tight">
            {book.title}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{book.author}</span>
          <span className="mt-3 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
            {book.lumiNote}
          </span>
        </span>
      </Link>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Link
          to="/reader/$bookId"
          params={{ bookId: gutenbergReaderId(book.gutenbergId) }}
          className="btn-primary px-4 py-2 text-xs"
        >
          <BookOpenCheck className="h-3.5 w-3.5" /> Ler agora
        </Link>
        <SaveButton saving={saving} added={added} onClick={onSave} />
      </div>
    </article>
  );
}

function PublicBookCard({
  book,
  saving,
  added,
  onSave,
}: {
  book: PublicDomainSummary;
  saving: boolean;
  added: boolean;
  onSave: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-border bg-card/70 p-4 shadow-[0_24px_50px_-40px_rgb(0_0_0/0.8)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-gold/45">
      <Link
        to="/reader/$bookId"
        params={{ bookId: gutenbergReaderId(book.id) }}
        className="flex gap-4"
      >
        <BookCover title={book.title} cover={book.cover} />
        <span className="min-w-0">
          <span className="inline-flex rounded-full bg-gold/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
            Leitura completa
          </span>
          <span className="mt-3 block truncate font-display text-2xl leading-tight">
            {book.title}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{book.author}</span>
        </span>
      </Link>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Link
          to="/reader/$bookId"
          params={{ bookId: gutenbergReaderId(book.id) }}
          className="btn-primary px-4 py-2 text-xs"
        >
          <BookOpenCheck className="h-3.5 w-3.5" /> Ler agora
        </Link>
        <span className="flex items-center gap-1">
          <a
            href={`https://www.gutenberg.org/ebooks/${book.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Ver no Project Gutenberg"
            title="Ver no Project Gutenberg"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-gold"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <SaveButton saving={saving} added={added} onClick={onSave} />
        </span>
      </div>
    </article>
  );
}

function CatalogBookCard({
  book,
  saving,
  added,
  onSave,
}: {
  book: BookMeta;
  saving: boolean;
  added: boolean;
  onSave: () => void;
}) {
  const slug = slugFor(book.title, book.author) || "livro";
  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-border bg-card/70 p-4 shadow-[0_24px_50px_-40px_rgb(0_0_0/0.8)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-gold/45">
      <Link
        to="/livro/$slug"
        params={{ slug }}
        search={{ title: book.title, author: book.author }}
        className="flex gap-4"
      >
        <BookCover title={book.title} cover={book.cover} />
        <span className="min-w-0">
          <span className="inline-flex rounded-full border border-border/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Catálogo
          </span>
          <span className="mt-3 block truncate font-display text-2xl leading-tight">
            {book.title}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {book.author || "Autor desconhecido"}
          </span>
          <span className="mt-3 block text-xs leading-relaxed text-muted-foreground">
            Consulte detalhes e adicione à sua biblioteca.
          </span>
        </span>
      </Link>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Link
          to="/livro/$slug"
          params={{ slug }}
          search={{ title: book.title, author: book.author }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gold"
        >
          Detalhes <ExternalLink className="h-3 w-3" />
        </Link>
        <SaveButton saving={saving} added={added} onClick={onSave} />
      </div>
    </article>
  );
}

function BookCover({ title, cover }: { title: string; cover: string | null }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <Tilt max={14} className="shrink-0 rounded-lg">
      <div className="book-shadow relative h-32 w-[5.35rem] shrink-0 overflow-hidden rounded-[3px_8px_8px_3px] bg-secondary">
        {/* The typographic cover is always there; the real artwork fades in
            over it once loaded, so slow or blocked image hosts never show
            broken-image text. */}
        <FauxCover
          book={fauxBookFor(title)}
          className="absolute inset-0 h-full w-full rounded-none"
        />
        {cover && !failed && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </div>
    </Tilt>
  );
}

function SaveButton({
  saving,
  added,
  onClick,
}: {
  saving: boolean;
  added: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving || added}
      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-gold/45 hover:text-gold disabled:opacity-60"
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : added ? (
        <>
          <Check className="h-3 w-3" /> Salvo
        </>
      ) : (
        <>
          <Plus className="h-3 w-3" /> Salvar
        </>
      )}
    </button>
  );
}

function LoadingCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-44 animate-pulse rounded-2xl border border-border/60 bg-secondary/50"
        />
      ))}
    </>
  );
}

function InlineState({
  state,
  empty,
  onRetry,
}: {
  state: SourceState;
  empty: string;
  onRetry: () => void;
}) {
  const isError = state === "error";
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-border/70 bg-secondary/25 p-7 text-center">
      <p className="text-sm text-muted-foreground">
        {isError
          ? "A fonte não respondeu agora. Sua busca continua disponível para tentar de novo."
          : empty}
      </p>
      {isError && (
        <button onClick={onRetry} className="mt-3 text-sm font-semibold text-gold hover:opacity-75">
          Tentar novamente
        </button>
      )}
    </div>
  );
}
