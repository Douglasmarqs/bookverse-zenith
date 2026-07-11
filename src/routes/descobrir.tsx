import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Plus, Check, ExternalLink, Loader2 } from "lucide-react";
import { searchBooks, type BookMeta } from "@/lib/google-books";
import { addToLibrary } from "@/lib/library";
import { subscribeAuth } from "@/lib/firebase";
import type { User } from "firebase/auth";
import { useNavigate } from "@tanstack/react-router";

const CATEGORIES = [
  "Ficção",
  "Clássicos",
  "Ficção científica",
  "Poesia",
  "Ensaios",
  "Filosofia",
  "Biografias",
  "Romance",
  "Mistério",
];

export const Route = createFileRoute("/descobrir")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Descobrir — BookVerse" },
      { name: "description", content: "Busque livros reais e adicione à sua biblioteca." },
    ],
  }),
  component: DescobrirPage,
});

function DescobrirPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState(search.q ?? "");
  const [results, setResults] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => subscribeAuth(setUser), []);

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchBooks(search.q ?? "", { category: search.categoria }).then((r) => {
      if (!cancelled) {
        setResults(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [search.q, search.categoria]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/descobrir", search: { q: query || undefined, categoria: search.categoria } });
  }

  async function handleAdd(book: BookMeta) {
    if (!user || user.isAnonymous) {
      navigate({ to: "/auth", search: { redirect: "/descobrir" } });
      return;
    }
    const key = `${book.title}::${book.author}`;
    await addToLibrary(user.uid, book, "quero-ler");
    setAdded((s) => new Set(s).add(key));
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Descobrir</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">
        Encontre seu próximo livro
      </h1>

      <form onSubmit={runSearch} className="mt-8 flex max-w-xl items-center gap-2">
        <div className="flex flex-1 items-center gap-3 rounded-full border border-border bg-secondary/30 px-4 py-3 focus-within:border-gold/60">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, autor…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground"
        >
          Buscar
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2.5">
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
              className={`rounded-full border px-4 py-2 text-sm transition ${
                activeC
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border bg-secondary/40 text-foreground/85 hover:border-gold/40 hover:text-gold"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="mt-10">
        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando livros…
          </div>
        ) : results.length === 0 ? (
          <p className="py-16 text-sm text-muted-foreground">
            {search.q || search.categoria
              ? "Nenhum livro encontrado. Tente outro termo ou categoria."
              : "Digite um termo ou escolha uma categoria para começar."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {results.map((book) => {
              const key = `${book.title}::${book.author}`;
              const isAdded = added.has(key);
              return (
                <div key={key} className="group">
                  <div className="relative">
                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt={book.title}
                        loading="lazy"
                        className="book-shadow aspect-[2/3] w-full rounded-md object-cover"
                      />
                    ) : (
                      <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center">
                        <span className="font-display text-xs text-foreground/70">{book.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 min-w-0">
                    <p className="truncate font-display text-sm font-medium">{book.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => handleAdd(book)}
                        disabled={isAdded}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] hover:border-gold/40 hover:text-gold disabled:opacity-60"
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3 w-3" /> Na biblioteca
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" /> Adicionar
                          </>
                        )}
                      </button>
                      {book.previewLink && (
                        <a
                          href={book.previewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:text-gold"
                          aria-label="Ver detalhes"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
