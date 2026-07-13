import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Sparkles, Plus, Check, Loader2, BookOpenCheck } from "lucide-react";
import {
  booksBySubject,
  trendingBooks,
  type OpenLibraryBook,
} from "@/lib/open-library";
import { searchPublicDomainBooks, gutenbergReaderId, type PublicDomainSummary } from "@/lib/public-domain";
import { addToLibrary } from "@/lib/library";
import { subscribeAuth } from "@/lib/firebase";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — BookVerse" },
      {
        name: "description",
        content:
          "Bestsellers, tendências e prateleiras curadas por gênero. Descubra e adicione títulos à sua biblioteca.",
      },
      { property: "og:title", content: "Catálogo — BookVerse" },
      {
        property: "og:description",
        content: "Bestsellers, tendências e prateleiras curadas por gênero.",
      },
    ],
  }),
  component: CatalogoPage,
});

const SHELVES: { key: string; subject: string; title: string; eyebrow: string }[] = [
  { key: "fiction", subject: "fiction", title: "Ficção contemporânea", eyebrow: "Ficção" },
  { key: "fantasy", subject: "fantasy", title: "Fantasia e magia", eyebrow: "Fantasia" },
  { key: "mystery", subject: "mystery_and_detective_stories", title: "Mistério e suspense", eyebrow: "Mistério" },
  { key: "scifi", subject: "science_fiction", title: "Ficção científica", eyebrow: "Sci-Fi" },
  { key: "romance", subject: "romance", title: "Romance", eyebrow: "Romance" },
  { key: "biography", subject: "biography", title: "Biografias marcantes", eyebrow: "Biografias" },
  { key: "history", subject: "history", title: "História", eyebrow: "História" },
  { key: "philosophy", subject: "philosophy", title: "Filosofia", eyebrow: "Filosofia" },
];

function CatalogoPage() {
  const [trending, setTrending] = useState<OpenLibraryBook[]>([]);
  const [bestsellers, setBestsellers] = useState<OpenLibraryBook[]>([]);
  const [shelves, setShelves] = useState<Record<string, OpenLibraryBook[]>>({});
  const [publicDomain, setPublicDomain] = useState<PublicDomainSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tr, best, pd, ...shelfResults] = await Promise.all([
        trendingBooks("weekly", 12),
        booksBySubject("bestsellers", 12),
        searchPublicDomainBooks("classic literature", 12),
        ...SHELVES.map((s) => booksBySubject(s.subject, 10)),
      ]);
      if (cancelled) return;
      setTrending(tr);
      setBestsellers(best);
      setPublicDomain(pd);
      const map: Record<string, OpenLibraryBook[]> = {};
      SHELVES.forEach((s, i) => (map[s.key] = shelfResults[i]));
      setShelves(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Catálogo</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">
        Um mundo de livros esperando por você
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Bestsellers, tendências da semana e prateleiras curadas por gênero — capa e metadados
        reais via Open Library. Os títulos em domínio público podem ser lidos direto no app.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando catálogo…
        </div>
      ) : (
        <>
          {publicDomain.length > 0 && (
            <Shelf
              eyebrow="Ler agora"
              title="Clássicos em domínio público"
              icon={<BookOpenCheck className="h-4 w-4" />}
            >
              <BookRail>
                {publicDomain.map((b) => (
                  <PublicDomainCard key={b.id} book={b} />
                ))}
              </BookRail>
            </Shelf>
          )}

          {trending.length > 0 && (
            <Shelf
              eyebrow="Em alta"
              title="Tendências da semana"
              icon={<Flame className="h-4 w-4" />}
            >
              <BookRail>
                {trending.map((b, i) => (
                  <OpenLibraryCard key={b.workKey + i} book={b} rank={i + 1} />
                ))}
              </BookRail>
            </Shelf>
          )}

          {bestsellers.length > 0 && (
            <Shelf
              eyebrow="Mais vendidos"
              title="Bestsellers"
              icon={<Sparkles className="h-4 w-4" />}
            >
              <BookRail>
                {bestsellers.map((b, i) => (
                  <OpenLibraryCard key={b.workKey + i} book={b} />
                ))}
              </BookRail>
            </Shelf>
          )}

          {SHELVES.map((s) =>
            shelves[s.key]?.length ? (
              <Shelf key={s.key} eyebrow={s.eyebrow} title={s.title}>
                <BookRail>
                  {shelves[s.key].map((b, i) => (
                    <OpenLibraryCard key={b.workKey + i} book={b} />
                  ))}
                </BookRail>
              </Shelf>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}

function Shelf({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
          {icon}
          {eyebrow}
        </div>
        <h2 className="mt-2 font-display text-2xl font-medium md:text-3xl">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function BookRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function OpenLibraryCard({ book, rank }: { book: OpenLibraryBook; rank?: number }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [added, setAdded] = useState(false);
  useEffect(() => subscribeAuth(setUser), []);

  async function add(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) {
      navigate({ to: "/auth", search: { redirect: "/catalogo" } });
      return;
    }
    await addToLibrary(user.uid, book, "quero-ler");
    setAdded(true);
  }

  const slug = `${book.title}-${book.author}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 140) || "livro";

  return (
    <div className="group relative w-40 shrink-0 snap-start sm:w-44">
      <Link
        to="/livro/$slug"
        params={{ slug }}
        search={{ title: book.title, author: book.author }}
        className="block"
      >
        <div className="relative">
          {book.cover ? (
            <img
              src={book.cover}
              alt={book.title}
              loading="lazy"
              className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-500 group-hover:-translate-y-1"
            />
          ) : (
            <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center">
              <span className="font-display text-xs text-foreground/70">{book.title}</span>
            </div>
          )}
          {rank !== undefined && (
            <span className="absolute -bottom-3 -left-2 font-display text-5xl font-semibold text-gold/90 [text-shadow:0_4px_12px_rgba(0,0,0,0.7)]">
              {rank}
            </span>
          )}
        </div>
        <div className="mt-4 min-w-0">
          <p className="truncate font-display text-[15px] font-medium">{book.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
        </div>
      </Link>
      <button
        onClick={add}
        disabled={added}
        className="mt-2 inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] hover:border-gold/40 hover:text-gold disabled:opacity-60"
      >
        {added ? (
          <>
            <Check className="h-3 w-3" /> Na biblioteca
          </>
        ) : (
          <>
            <Plus className="h-3 w-3" /> Adicionar
          </>
        )}
      </button>
    </div>
  );
}

function PublicDomainCard({ book }: { book: PublicDomainSummary }) {
  return (
    <Link
      to="/reader/$bookId"
      params={{ bookId: gutenbergReaderId(book.id) }}
      className="group w-40 shrink-0 snap-start sm:w-44"
    >
      {book.cover ? (
        <img
          src={book.cover}
          alt={book.title}
          loading="lazy"
          className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform group-hover:-translate-y-1"
        />
      ) : (
        <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center">
          <span className="font-display text-xs text-foreground/70">{book.title}</span>
        </div>
      )}
      <p className="mt-3 truncate font-display text-sm font-medium">{book.title}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-gold">
        <BookOpenCheck className="h-3 w-3" /> Ler agora
      </span>
    </Link>
  );
}
