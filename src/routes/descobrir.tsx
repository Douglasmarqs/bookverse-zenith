import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpenCheck, Check, Compass, ExternalLink, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { describeFirestoreError } from "@/lib/async-utils";
import { searchBooks, type BookMeta } from "@/lib/google-books";
import { addToLibrary, slugFor } from "@/lib/library";
import {
  gutenbergReaderId,
  searchPublicDomainBooks,
  type PublicDomainSummary,
} from "@/lib/public-domain";
import { LanguageBadge } from "@/components/language-badge";
import { BookGridSkeleton } from "@/components/book-grid-skeleton";
import { useAuthUser } from "@/hooks/use-auth-user";

const CATEGORIES = [
  "Clássicos",
  "Ficção",
  "Ficção científica",
  "Poesia",
  "Filosofia",
  "Mistério",
  "Romance",
  "Biografias",
];
const INITIAL_QUERY = "literatura brasileira";

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
        content: "Pesquise títulos reais e encontre obras de domínio público que abrem no leitor.",
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
  const [loading, setLoading] = useState(false);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => setQuery(search.q ?? ""), [search.q]);

  useEffect(() => {
    let cancelled = false;
    const effectiveQuery = search.q?.trim() || search.categoria || INITIAL_QUERY;
    setLoading(true);
    setCatalogUnavailable(false);
    Promise.allSettled([
      searchPublicDomainBooks(effectiveQuery, 16),
      searchBooks(effectiveQuery, { category: search.categoria, maxResults: 20 }),
    ])
      .then(([publicResult, catalogResult]) => {
        if (cancelled) return;
        setPublicBooks(publicResult.status === "fulfilled" ? publicResult.value : []);
        if (catalogResult.status === "fulfilled") {
          setCatalogBooks(catalogResult.value.results);
          setCatalogUnavailable(catalogResult.value.networkError);
        } else {
          setCatalogBooks([]);
          setCatalogUnavailable(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search.q, search.categoria]);

  function runSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate({
      to: "/descobrir",
      search: { q: query.trim() || undefined, categoria: search.categoria },
    });
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

  const heading = search.q || search.categoria ? "Resultados da sua busca" : "Livros em destaque";
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/45 p-6 md:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
            <Compass className="h-3.5 w-3.5" /> Descobrir
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-medium leading-tight md:text-5xl">
            Encontre um livro com informações claras sobre como ele pode ser lido.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Obras de domínio público têm o texto completo no BookVerse. Os demais resultados são
            referências de catálogo: você pode consultar detalhes e guardá-los na estante, sem
            prometer acesso ao texto.
          </p>
          <form onSubmit={runSearch} className="mt-7 flex max-w-2xl gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-border bg-background/50 px-4 py-3 focus-within:border-gold/60">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, autor ou tema"
                aria-label="Buscar livros"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Buscar
            </button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => {
              const active = search.categoria === category;
              return (
                <button
                  key={category}
                  onClick={() =>
                    navigate({
                      to: "/descobrir",
                      search: { q: search.q, categoria: active ? undefined : category },
                    })
                  }
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${active ? "border-gold bg-gold/10 text-gold" : "border-border bg-background/30 text-foreground/85 hover:border-gold/45 hover:text-gold"}`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
          <BookOpenCheck className="h-3.5 w-3.5" /> Leitura no BookVerse
        </p>
        <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">
          Obras de domínio público disponíveis no leitor
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Estes títulos têm texto completo e abrem diretamente no leitor.
        </p>
        {loading ? (
          <BookGridSkeleton count={8} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        ) : publicBooks.length ? (
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {publicBooks.map((book) => (
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
            ))}
          </div>
        ) : (
          <Empty text="Não encontramos uma obra de domínio público com esse termo. Tente uma busca diferente." />
        )}
      </section>

      <section className="mt-14 border-t border-border/60 pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
          Catálogo de livros
        </p>
        <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">{heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Capa, autoria e detalhes vêm de fontes de catálogo. Um item aqui não significa que o
          arquivo esteja disponível para leitura no BookVerse.
        </p>
        {loading ? (
          <BookGridSkeleton count={8} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        ) : catalogUnavailable ? (
          <Empty text="O catálogo não respondeu agora. As obras públicas acima continuam disponíveis; tente novamente em instantes." />
        ) : catalogBooks.length ? (
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {catalogBooks.map((book) => {
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
            })}
          </div>
        ) : (
          <Empty text="Nenhum resultado de catálogo para essa busca." />
        )}
      </section>
    </main>
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
    <article className="group min-w-0">
      <Link to="/reader/$bookId" params={{ bookId: gutenbergReaderId(book.id) }}>
        <Cover title={book.title} cover={book.cover} />
        <LanguageBadge languages={book.languages} />
        <p className="mt-3 truncate font-display text-sm font-medium">{book.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          to="/reader/$bookId"
          params={{ bookId: gutenbergReaderId(book.id) }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold"
        >
          <BookOpenCheck className="h-3 w-3" /> Ler no BookVerse
        </Link>
        <SaveButton saving={saving} added={added} onClick={onSave} />
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
    <article className="group min-w-0">
      <Link to="/livro/$slug" params={{ slug }} search={{ title: book.title, author: book.author }}>
        <Cover title={book.title} cover={book.cover} />
        <p className="mt-3 truncate font-display text-sm font-medium">{book.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          to="/livro/$slug"
          params={{ slug }}
          search={{ title: book.title, author: book.author }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold"
        >
          Ver detalhes <ExternalLink className="h-3 w-3" />
        </Link>
        <SaveButton saving={saving} added={added} onClick={onSave} />
      </div>
    </article>
  );
}

function Cover({ title, cover }: { title: string; cover: string | null }) {
  return (
    <div className="relative">
      {cover ? (
        <img
          src={cover}
          alt={`Capa de ${title}`}
          loading="lazy"
          className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-300 group-hover:-translate-y-1"
        />
      ) : (
        <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center font-display text-xs text-foreground/70">
          {title}
        </div>
      )}
    </div>
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
      className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-gold/45 hover:text-gold disabled:opacity-60"
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

function Empty({ text }: { text: string }) {
  return <p className="py-12 text-sm text-muted-foreground">{text}</p>;
}
