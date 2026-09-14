import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, ExternalLink, Heart, Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { describeFirestoreError } from "@/lib/async-utils";
import { z } from "zod";
import { fetchBookMeta, type BookMeta } from "@/lib/google-books";
import {
  addToLibrary,
  setFavorite,
  setRating,
  slugFor,
  subscribeLibrary,
  type LibraryEntry,
} from "@/lib/library";
import { subscribeAuth } from "@/lib/firebase";
import { BookCover } from "@/components/book-cover";
import { BookReviews } from "@/components/book-reviews";
import { LumiRecommendationCard } from "@/components/lumi-recommendation-card";
import type { User } from "firebase/auth";

const searchSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional().default(""),
});

export const Route = createFileRoute("/livro/$slug")({
  validateSearch: (search) => searchSchema.parse(search),
  head: ({ match }) => {
    const title = (match.search as { title?: string })?.title ?? "Detalhes do livro";
    return {
      meta: [
        { title: `${title} — BookVerse` },
        {
          name: "description",
          content: `Sinopse, autores e categorias de "${title}". Adicione à sua biblioteca no BookVerse.`,
        },
        { property: "og:title", content: `${title} — BookVerse` },
      ],
    };
  },
  component: LivroDetalhesPage,
});

function LivroDetalhesPage() {
  const { title, author } = Route.useSearch();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<BookMeta | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [added, setAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setLibrary([]);
      return;
    }
    return subscribeLibrary(user.uid, setLibrary);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setMeta(undefined);
    fetchBookMeta(title, author || undefined)
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [title, author]);

  const resolvedAuthor = meta?.author || author || "Autor desconhecido";
  const description = meta?.description;
  const categories = meta?.categories ?? [];
  // Id estável das resenhas: derivado dos parâmetros da URL (não do meta
  // carregado depois), para não trocar de coleção quando a busca resolver.
  const bookId = slugFor(title, author || undefined);
  const libraryEntry = useMemo(
    () => library.find((entry) => entry.id === bookId),
    [bookId, library],
  );
  const readerId = meta?.readerId ?? libraryEntry?.readerId ?? null;
  const canReadHere = Boolean(readerId);

  async function handleAdd() {
    if (!user || user.isAnonymous) {
      navigate({
        to: "/auth",
        search: { redirect: window.location.pathname + window.location.search },
      });
      return;
    }
    setSaving(true);
    try {
      await addToLibrary(
        user.uid,
        {
          ...(meta ?? {}),
          title: meta?.title ?? title,
          author: resolvedAuthor,
          cover: meta?.cover ?? null,
          readerId: meta?.readerId ?? null,
        },
        "quero-ler",
      );
      setAdded(true);
      toast.success("Adicionado à sua biblioteca.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível adicionar este livro agora."));
    } finally {
      setSaving(false);
    }
  }

  async function handleFavorite() {
    if (!user || user.isAnonymous || !libraryEntry) return;
    try {
      await setFavorite(user.uid, libraryEntry.id, !libraryEntry.favorite);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível atualizar os favoritos."));
    }
  }

  async function handleRating(rating: number) {
    if (!user || user.isAnonymous || !libraryEntry) return;
    try {
      await setRating(user.uid, libraryEntry.id, rating === libraryEntry.rating ? 0 : rating);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar sua avaliação."));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <button
        onClick={() => window.history.back()}
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="grid gap-10 md:grid-cols-[280px_1fr] md:gap-14">
        <div>
          <BookCover
            title={meta?.title ?? title}
            author={resolvedAuthor}
            className="book-shadow w-full rounded-lg object-cover"
          />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Livro</p>
          <h1 className="mt-2 font-display text-3xl font-medium md:text-4xl">
            {meta?.title ?? title}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{resolvedAuthor}</p>

          {meta?.averageRating !== undefined && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-foreground/80">
              <Star className="h-4 w-4 fill-gold text-gold" />
              <span className="font-medium">{meta.averageRating.toFixed(1)}</span>
              {meta.ratingsCount ? (
                <span className="text-muted-foreground">({meta.ratingsCount} avaliações)</span>
              ) : null}
            </div>
          )}

          {categories.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {categories.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border/60 px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {canReadHere ? (
              <Link
                to="/reader/$bookId"
                params={{ bookId: readerId! }}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                <BookOpen className="h-4 w-4" /> Ler no BookVerse
              </Link>
            ) : (
              <button
                onClick={handleAdd}
                disabled={added || saving || Boolean(libraryEntry)}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Adicionando…
                  </>
                ) : added || libraryEntry ? (
                  <>
                    <Check className="h-4 w-4" /> Na sua biblioteca
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Adicionar à biblioteca
                  </>
                )}
              </button>
            )}
            <Link
              to="/biblioteca"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm hover:border-gold/40 hover:text-gold"
            >
              <BookOpen className="h-4 w-4" /> Minha biblioteca
            </Link>
            {libraryEntry && (
              <button
                onClick={handleFavorite}
                aria-pressed={Boolean(libraryEntry.favorite)}
                className={`grid h-10 w-10 place-items-center rounded-full border transition ${libraryEntry.favorite ? "border-gold bg-gold/10 text-gold" : "border-border/60 text-muted-foreground hover:text-gold"}`}
                title={libraryEntry.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <Heart className={`h-4 w-4 ${libraryEntry.favorite ? "fill-current" : ""}`} />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span
              className={`rounded-full px-3 py-1 ${canReadHere ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-secondary"}`}
            >
              {canReadHere ? "Disponível para leitura aqui" : "Catálogo e resenhas"}
            </span>
            {!canReadHere && (
              <span>Para ler, importe um EPUB ou PDF que você possui na sua biblioteca.</span>
            )}
            {meta?.previewLink && (
              <a
                href={meta.previewLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-gold hover:underline"
              >
                Prévia da fonte <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {libraryEntry && (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sua avaliação:</span>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => void handleRating(rating)}
                  aria-label={`${rating} estrelas`}
                  className="p-0.5 text-gold"
                >
                  <Star
                    className={`h-4 w-4 ${rating <= (libraryEntry.rating ?? 0) ? "fill-current" : ""}`}
                  />
                </button>
              ))}
            </div>
          )}

          <section className="mt-10">
            <h2 className="font-display text-lg font-medium">Sinopse</h2>
            {meta === undefined ? (
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-secondary" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
              </div>
            ) : description ? (
              <div
                className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/85"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Ainda não temos uma sinopse para este título. Adicione à sua biblioteca para
                acompanhar quando ela ficar disponível.
              </p>
            )}
          </section>
        </div>
      </div>

      <section className="mt-16 border-t border-border/50 pt-10">
        <BookReviews bookId={bookId} user={user} />
      </section>

      {user && !user.isAnonymous && (
        <section className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Para depois
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium">
            Uma sugestão feita para sua estante
          </h2>
          <div className="mt-4">
            <LumiRecommendationCard user={user} libraryEntries={library} />
          </div>
        </section>
      )}
    </div>
  );
}
