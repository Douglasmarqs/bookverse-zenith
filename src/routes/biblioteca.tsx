import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Trash2,
  BookOpenCheck,
  Loader2,
  UploadCloud,
  FileUp,
  Search,
  X,
  ChevronDown,
  Heart,
  Star,
  Library,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { toast } from "sonner";
import { describeFirestoreError } from "@/lib/async-utils";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { TelegramCard } from "@/components/telegram-card";
import { FauxCover } from "@/components/faux-cover";
import { fauxBookFor } from "@/lib/faux-books";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addToLibrary,
  removeFromLibrary,
  setFavorite,
  setLibraryStatus,
  setRating,
  updateLibraryCover,
  slugFor,
  subscribeLibrary,
  LIBRARY_STATUSES,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/library";
import {
  deleteEpubBook,
  deleteEpubBookFromCloud,
  isEpubReaderId,
  saveEpubBook,
  uploadEpubBookToCloud,
} from "@/lib/epub-store";
import {
  createPdfBook,
  deletePdfBook,
  deletePdfBookFromCloud,
  getPdfCoverFromCloud,
  isPdfReaderId,
  savePdfBook,
  uploadPdfBookToCloud,
} from "@/lib/pdf-store";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Minha biblioteca — BookVerse" },
      { name: "description", content: "Seus livros salvos, em progresso e concluídos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuardedBibliotecaPage,
});

const STATUS_LABEL: Record<LibraryStatus, string> = {
  "quero-ler": "Quero ler",
  lendo: "Lendo",
  concluido: "Concluído",
  relendo: "Relendo",
  abandonado: "Abandonado",
};

/** Cor de "marcador de página" por estante, como nas capas do Skoob. */
const STATUS_BADGE: Record<LibraryStatus, string> = {
  lendo: "bg-gold/90 text-primary-foreground",
  "quero-ler": "bg-background/85 text-foreground ring-1 ring-border/60",
  concluido: "bg-emerald-500/85 text-white",
  relendo: "bg-sky-500/85 text-white",
  abandonado: "bg-zinc-600/85 text-white",
};

type FilterTab = "todos" | "favoritos" | LibraryStatus;
type LibraryView = "lombadas" | "capas" | "lista";
const VIEW_KEY = "bookverse:library-view";
type SortKey = "recent" | "title" | "author" | "rating";

function GuardedBibliotecaPage() {
  const { state, user } = useRequireAuth();
  if (state !== "authenticated" || !user) {
    return (
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-md place-items-center px-6 text-center">
        <div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="mt-4 text-sm text-muted-foreground">
            {state === "loading" ? "Verificando sua sessão…" : "Redirecionando para o login…"}
          </p>
        </div>
      </div>
    );
  }
  return <BibliotecaPage uid={user.uid} />;
}

function BibliotecaPage({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("todos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState<LibraryView>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === "capas" || v === "lista" ? v : "lombadas";
    } catch {
      return "lombadas";
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  function changeView(v: LibraryView) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage unavailable
    }
  }
  const coverRecoveryRef = useRef(new Set<string>());

  useEffect(() => subscribeLibrary(uid, setEntries), [uid]);

  useEffect(() => {
    if (!entries) return;
    for (const entry of entries) {
      if (entry.cover || !entry.readerId || !isPdfReaderId(entry.readerId)) continue;
      if (coverRecoveryRef.current.has(entry.readerId)) continue;
      coverRecoveryRef.current.add(entry.readerId);
      void getPdfCoverFromCloud(uid, entry.readerId).then((cover) => {
        if (cover) return updateLibraryCover(uid, entry.id, cover);
      });
    }
  }, [entries, uid]);

  // Safety net: if Firestore's realtime listener never calls back at all
  // (fully offline/blocked, no cache), stop showing the spinner forever —
  // fall back to the empty state instead.
  useEffect(() => {
    const timer = setTimeout(() => setEntries((e) => (e === null ? [] : e)), 10000);
    return () => clearTimeout(timer);
  }, []);

  async function handleStatusChange(id: string, status: LibraryStatus) {
    if (busy.has(id)) return;
    setBusy((s) => new Set(s).add(id));
    try {
      await setLibraryStatus(uid, id, status);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível atualizar o status."));
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleRemove(entry: LibraryEntry) {
    if (busy.has(entry.id)) return;
    setBusy((s) => new Set(s).add(entry.id));
    try {
      if (entry.readerId && isEpubReaderId(entry.readerId)) {
        // Delete the durable source before its library pointer. If the cloud
        // operation is denied or interrupted, leave the entry intact so the
        // person never sees a false "removed" success while a private file
        // remains orphaned.
        await deleteEpubBookFromCloud(uid, entry.readerId);
        await deleteEpubBook(entry.readerId).catch(() => {});
      } else if (entry.readerId && isPdfReaderId(entry.readerId)) {
        await deletePdfBookFromCloud(uid, entry.readerId);
        await deletePdfBook(entry.readerId).catch(() => {});
      }
      await removeFromLibrary(uid, entry.id);
      toast.success("Livro removido da biblioteca.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível remover este livro."));
      setBusy((s) => {
        const next = new Set(s);
        next.delete(entry.id);
        return next;
      });
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      if (isPdf) {
        const book = await createPdfBook(file);
        await savePdfBook(book);
        try {
          await uploadPdfBookToCloud(uid, book);
          await addToLibrary(
            uid,
            {
              title: book.title,
              author: book.author,
              cover: book.cover ?? null,
              readerId: book.id,
            },
            "quero-ler",
          );
        } catch (err) {
          void deletePdfBook(book.id).catch(() => {});
          void deletePdfBookFromCloud(uid, book.id).catch(() => {});
          throw err;
        }
        toast.success('"' + book.title + '" adicionado à sua biblioteca.', {
          action: {
            label: "Ler agora",
            onClick: () => navigate({ to: "/reader/$bookId", params: { bookId: book.id } }),
          },
        });
        return;
      }
      // Lazy-loaded: jszip is a sizeable dependency that only readers who
      // actually use "Adicionar EPUB" should pay the download cost for.
      const { parseEpubFile } = await import("@/lib/epub-parser");
      const book = await parseEpubFile(file);
      await saveEpubBook(book);
      try {
        await uploadEpubBookToCloud(uid, book, file);
        await addToLibrary(
          uid,
          { title: book.title, author: book.author, cover: book.cover, readerId: book.id },
          "quero-ler",
        );
      } catch (err) {
        void deleteEpubBook(book.id).catch(() => {});
        void deleteEpubBookFromCloud(uid, book.id).catch(() => {});
        throw err;
      }
      toast.success(`"${book.title}" adicionado à sua biblioteca.`, {
        action: {
          label: "Ler agora",
          onClick: () => navigate({ to: "/reader/$bookId", params: { bookId: book.id } }),
        },
      });
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível importar este arquivo."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = {
      todos: entries?.length ?? 0,
      favoritos: 0,
      "quero-ler": 0,
      lendo: 0,
      concluido: 0,
      relendo: 0,
      abandonado: 0,
    };
    for (const e of entries ?? []) {
      if (e.status in c) c[e.status] += 1;
      if (e.favorite) c.favoritos += 1;
    }
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    let list = entries ?? [];
    if (filter === "favoritos") list = list.filter((e) => e.favorite);
    else if (filter !== "todos") list = list.filter((e) => e.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) => e.title.toLowerCase().includes(q) || e.author.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    else if (sort === "author") sorted.sort((a, b) => a.author.localeCompare(b.author, "pt-BR"));
    else if (sort === "rating") sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    // "recent" relies on Firestore's natural order (addedAt-ish) already
    // present in `entries` — no client re-sort needed.
    return sorted;
  }, [entries, filter, query, sort]);

  const SORT_LABEL: Record<SortKey, string> = {
    recent: "Adicionados recentemente",
    title: "Título (A–Z)",
    author: "Autor (A–Z)",
    rating: "Melhor avaliados",
  };

  async function handleFavorite(entry: LibraryEntry) {
    try {
      await setFavorite(uid, entry.id, !entry.favorite);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível atualizar os favoritos."));
    }
  }

  async function handleRating(entry: LibraryEntry, rating: number) {
    try {
      await setRating(uid, entry.id, rating);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar sua avaliação."));
    }
  }

  return (
    <div
      className="relative mx-auto max-w-[84rem] px-5 py-8 md:px-10 md:py-10"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleUpload(file);
      }}
    >
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-background/80 backdrop-blur-sm"
          >
            <div className="rounded-[2rem] border-2 border-dashed border-gold bg-card/90 px-12 py-10 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-gold" />
              <p className="mt-3 font-display text-4xl">Solte para importar</p>
              <p className="text-sm text-muted-foreground">
                EPUB ou PDF · fica privado na sua conta
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">
            Minha estante
            {entries && entries.length > 0
              ? ` · ${counts.todos} ${counts.todos === 1 ? "livro" : "livros"}`
              : ""}
          </p>
          <h1 className="mt-2 font-display text-5xl leading-none md:text-6xl">
            Sua <span className="italic text-gold">biblioteca</span>
          </h1>
          {entries && entries.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {counts.lendo} lendo · {counts["quero-ler"]} na fila · {counts.concluido} concluído
              {counts.concluido === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="radiogroup"
            aria-label="Visualização"
            className="flex rounded-full border border-border bg-card/60 p-1"
          >
            {(
              [
                ["lombadas", "Lombadas", Library],
                ["capas", "Capas", LayoutGrid],
                ["lista", "Lista", ListIcon],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                onClick={() => changeView(id)}
                className="press relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold"
              >
                {view === id && (
                  <motion.span
                    layoutId="library-view"
                    className="absolute inset-0 rounded-full bg-gold/15 ring-1 ring-gold/40"
                    transition={{ type: "spring", stiffness: 450, damping: 34 }}
                  />
                )}
                <Icon
                  className={`relative h-3.5 w-3.5 ${view === id ? "text-gold" : "text-muted-foreground"}`}
                />
                <span className={`relative ${view === id ? "text-gold" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf,application/epub+zip,application/pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {uploading ? "Importando…" : "Importar EPUB/PDF"}
          </button>
        </div>
      </div>

      {entries && entries.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-b border-border/70 pb-4">
          <div className="no-scrollbar -mx-5 flex w-[calc(100%+2.5rem)] gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
            {(["todos", "favoritos", ...LIBRARY_STATUSES] as FilterTab[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  filter === f
                    ? "bg-gold text-primary-foreground shadow-sm shadow-gold/20"
                    : "border border-border/70 bg-card/60 text-foreground/75 hover:border-gold/40 hover:text-gold"
                }`}
              >
                {f === "favoritos" && <Heart className="h-3 w-3" />}
                {f === "todos" ? "Todos" : f === "favoritos" ? "Favoritos" : STATUS_LABEL[f]} ·{" "}
                {counts[f]}
              </button>
            ))}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:ml-auto">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 sm:flex-none">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar na biblioteca"
                className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground sm:w-48"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Limpar busca" className="shrink-0">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </label>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-xs font-medium text-foreground/75 outline-none hover:border-gold/40 hover:text-gold">
                <span className="sm:hidden">Ordenar</span>
                <span className="hidden sm:inline">{SORT_LABEL[sort]}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <DropdownMenuItem
                    key={k}
                    onSelect={() => setSort(k)}
                    className={`rounded-lg text-xs ${sort === k ? "bg-gold/10 text-gold" : ""}`}
                  >
                    {SORT_LABEL[k]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {entries === null ? (
        <div className="mt-16 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] w-full rounded-lg bg-secondary/60" />
              <div className="mt-3 h-3 w-4/5 rounded bg-secondary/60" />
              <div className="mt-2 h-2.5 w-3/5 rounded bg-secondary/40" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="social-card mt-10 border-dashed p-12 text-center">
          <FileUp className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Sua biblioteca está vazia por enquanto.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/descobrir"
              search={{ q: undefined, categoria: undefined }}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-gold/20"
            >
              Descobrir livros
            </Link>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card px-5 py-2.5 text-sm font-semibold hover:border-gold/40 hover:text-gold"
            >
              Ou importe EPUB ou PDF
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="social-card mt-10 border-dashed p-12 text-center">
          <Search className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            {query
              ? `Nenhum resultado para "${query}".`
              : `Nenhum livro em "${STATUS_LABEL[filter as LibraryStatus] ?? filter}" ainda.`}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {view === "lombadas" ? (
              <ShelvesView
                entries={visible}
                selectedId={selectedId}
                onSelect={setSelectedId}
                renderCard={(entry) => (
                  <BookCard
                    entry={entry}
                    busy={busy.has(entry.id)}
                    onStatusChange={(status) => handleStatusChange(entry.id, status)}
                    onRemove={() => handleRemove(entry)}
                    onToggleFavorite={() => void handleFavorite(entry)}
                    onRate={(rating) => void handleRating(entry, rating)}
                  />
                )}
              />
            ) : view === "lista" ? (
              <ListView
                entries={visible}
                onStatusChange={(id, status) => void handleStatusChange(id, status)}
                onToggleFavorite={(entry) => void handleFavorite(entry)}
              />
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {visible.map((entry) => (
                  <BookCard
                    key={entry.id}
                    entry={entry}
                    busy={busy.has(entry.id)}
                    onStatusChange={(status) => handleStatusChange(entry.id, status)}
                    onRemove={() => handleRemove(entry)}
                    onToggleFavorite={() => void handleFavorite(entry)}
                    onRate={(rating) => void handleRating(entry, rating)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <TelegramCard />
    </div>
  );
}

function BookCard({
  entry,
  busy,
  onStatusChange,
  onRemove,
  onToggleFavorite,
  onRate,
}: {
  entry: LibraryEntry;
  busy: boolean;
  onStatusChange: (status: LibraryStatus) => void;
  onRemove: () => void;
  onToggleFavorite: () => void;
  onRate: (rating: number) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const primaryHref = entry.readerId
    ? { to: "/reader/$bookId" as const, params: { bookId: entry.readerId } }
    : {
        to: "/livro/$slug" as const,
        params: { slug: slugFor(entry.title, entry.author) || "livro" },
        search: { title: entry.title, author: entry.author },
      };

  return (
    <div className="group relative rounded-xl p-1.5 transition-colors hover:bg-card/65">
      <Link {...primaryHref} className="block">
        <div className="relative">
          {entry.cover ? (
            <img
              src={entry.cover}
              alt={entry.title}
              loading="lazy"
              className="book-shadow aspect-[2/3] w-full rounded-lg object-cover transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
            />
          ) : (
            <FauxCover
              book={fauxBookFor(entry.title, entry.author)}
              padTop
              className="!rounded-lg transition-transform duration-300 group-hover:-translate-y-1"
            />
          )}

          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${STATUS_BADGE[entry.status]}`}
          >
            {STATUS_LABEL[entry.status]}
          </span>

          {entry.readerId && (isEpubReaderId(entry.readerId) || isPdfReaderId(entry.readerId)) && (
            <span className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[9px] font-medium text-foreground/80 ring-1 ring-border/60 backdrop-blur-sm">
              {isPdfReaderId(entry.readerId) ? "PDF privado" : "EPUB privado"}
            </span>
          )}

          {/* Hover overlay with the primary action, like a Kindle/Apple Books tap target */}
          <div className="absolute inset-0 hidden items-end justify-center rounded-lg bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-black">
              <BookOpenCheck className="h-3 w-3" />
              {entry.readerId
                ? entry.status === "concluido"
                  ? "Reler"
                  : "Continuar lendo"
                : "Ver detalhes"}
            </span>
          </div>
        </div>
      </Link>

      {/* Favorito — fora do <Link> para o clique não abrir o livro */}
      <button
        onClick={onToggleFavorite}
        aria-label={entry.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
        aria-pressed={entry.favorite ?? false}
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/90 ring-1 ring-border/60 backdrop-blur-sm transition hover:scale-110"
      >
        <Heart
          className={`h-3.5 w-3.5 ${entry.favorite ? "fill-destructive text-destructive" : "text-muted-foreground"}`}
        />
      </button>

      <div className="mt-3 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <Link
            {...primaryHref}
            className="block truncate font-display text-sm font-semibold hover:text-gold"
          >
            {entry.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.author}</p>
          <div className="mt-0.5 -ml-1.5 flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRate(entry.rating === star ? 0 : star)}
                aria-label={`Avaliar com ${star} estrela${star === 1 ? "" : "s"}`}
                className="p-1.5 transition hover:scale-125"
              >
                <Star
                  className={`h-3 w-3 ${
                    (entry.rating ?? 0) >= star ? "fill-gold text-gold" : "text-muted-foreground/50"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            aria-label={`Mais opções para ${entry.title}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreDots />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
            <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Mover para
            </DropdownMenuLabel>
            {(Object.keys(STATUS_LABEL) as LibraryStatus[])
              .filter((st) => st !== entry.status)
              .map((st) => (
                <DropdownMenuItem
                  key={st}
                  onSelect={() => onStatusChange(st)}
                  className="rounded-lg text-xs"
                >
                  {STATUS_LABEL[st]}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-lg text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              Remover “{entry.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {entry.readerId && (isEpubReaderId(entry.readerId) || isPdfReaderId(entry.readerId))
                ? "O arquivo privado que você importou será apagado da sua conta e de todos os seus dispositivos. Esta ação não pode ser desfeita."
                : "O livro sai da sua biblioteca. Você pode adicioná-lo de novo a qualquer momento pelo Descobrir."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MoreDots() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <circle cx="4" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="16" cy="10" r="1.6" />
    </svg>
  );
}

const SHELF_ORDER: LibraryStatus[] = ["lendo", "relendo", "quero-ler", "concluido", "abandonado"];

/** Books as spines on real shelves, one shelf per status. Clicking a spine
 * pulls it out and shows its card (all actions) beside the shelf. */
function ShelvesView({
  entries,
  selectedId,
  onSelect,
  renderCard,
}: {
  entries: LibraryEntry[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  renderCard: (entry: LibraryEntry) => React.ReactNode;
}) {
  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const groups = SHELF_ORDER.map((status) => ({
    status,
    items: entries.filter((e) => e.status === status),
  })).filter((g) => g.items.length);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.status} aria-label={STATUS_LABEL[g.status]}>
            <p className="eyebrow mb-1">
              {STATUS_LABEL[g.status]} · {g.items.length}
            </p>
            <div
              className="flex flex-wrap items-end gap-x-[5px] px-2"
              style={{
                backgroundImage:
                  "linear-gradient(to top, var(--shelf-2) 0, var(--shelf) 11px, transparent 11px)",
                backgroundSize: "100% 196px",
                backgroundPosition: "0 0",
              }}
            >
              {g.items.map((e) => {
                const fb = fauxBookFor(e.title, e.author);
                const on = e.id === selectedId;
                const h = 128 + ((e.title.length * 11) % 46);
                const w = 34 + ((e.title.length * 5) % 20);
                const isFile =
                  !!e.readerId && (isEpubReaderId(e.readerId) || isPdfReaderId(e.readerId));
                return (
                  <div key={e.id} className="flex h-[196px] items-end pb-[11px]">
                    <motion.button
                      type="button"
                      onClick={() => onSelect(on ? null : e.id)}
                      aria-pressed={on}
                      aria-label={`${e.title}${e.author ? `, de ${e.author}` : ""}`}
                      title={e.title}
                      initial={{ rotate: 180 }}
                      animate={{ rotate: 180, y: on ? -18 : 0 }}
                      whileHover={{ y: on ? -18 : -9 }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      className="spine relative text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      style={
                        {
                          "--s-bg": isFile ? "#e8dcc4" : fb.bg,
                          "--s-fg": isFile ? "#2a241b" : fb.fg,
                          height: h,
                          width: w,
                          boxShadow: on
                            ? "0 0 0 2px var(--gold), 0 20px 40px -12px color-mix(in oklab, var(--gold) 55%, transparent)"
                            : undefined,
                        } as React.CSSProperties
                      }
                    >
                      <span className="truncate">{e.title}</span>
                      {e.favorite ? (
                        <Heart className="h-3 w-3 shrink-0 fill-current text-destructive" />
                      ) : isFile ? (
                        <span className="rotate-180 rounded-sm bg-[#2a241b] px-0.5 font-sans text-[8px] text-[#f3ead8] [writing-mode:horizontal-tb]">
                          {isPdfReaderId(e.readerId!) ? "PDF" : "EPUB"}
                        </span>
                      ) : null}
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[1.5rem] border border-border bg-card/70 p-3 backdrop-blur"
            >
              {renderCard(selected)}
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-[1.5rem] border border-dashed border-border p-5 text-sm text-muted-foreground"
            >
              Toque em uma lombada para ver o livro, mudar de estante, avaliar ou abrir.
            </motion.p>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
}

/** Compact, scannable rows — best for big libraries. */
function ListView({
  entries,
  onStatusChange,
  onToggleFavorite,
}: {
  entries: LibraryEntry[];
  onStatusChange: (id: string, status: LibraryStatus) => void;
  onToggleFavorite: (entry: LibraryEntry) => void;
}) {
  return (
    <ul className="mt-6 divide-y divide-border overflow-hidden rounded-[1.5rem] border border-border bg-card/50">
      {entries.map((e, i) => {
        const href = e.readerId
          ? { to: "/reader/$bookId" as const, params: { bookId: e.readerId } }
          : {
              to: "/livro/$slug" as const,
              params: { slug: slugFor(e.title, e.author) || "livro" },
              search: { title: e.title, author: e.author },
            };
        return (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.025 }}
            className="group flex items-center gap-4 px-4 py-3 transition hover:bg-secondary/50"
          >
            <Link {...href} className="w-10 shrink-0" aria-label={`Abrir ${e.title}`}>
              {e.cover ? (
                <img
                  src={e.cover}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] w-full rounded-[3px] object-cover"
                />
              ) : (
                <FauxCover book={fauxBookFor(e.title, e.author)} showText={false} />
              )}
            </Link>
            <Link {...href} className="min-w-0 flex-1">
              <p className="truncate font-display text-xl leading-tight group-hover:text-gold">
                {e.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">{e.author}</p>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="press hidden shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground outline-none hover:border-gold/40 hover:text-foreground sm:inline-flex">
                {STATUS_LABEL[e.status]} <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                {(Object.keys(STATUS_LABEL) as LibraryStatus[]).map((st) => (
                  <DropdownMenuItem
                    key={st}
                    onSelect={() => onStatusChange(e.id, st)}
                    className={`rounded-lg text-xs ${st === e.status ? "text-gold" : ""}`}
                  >
                    {STATUS_LABEL[st]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => onToggleFavorite(e)}
              aria-label={e.favorite ? "Remover dos favoritos" : "Marcar como favorito"}
              aria-pressed={e.favorite ?? false}
              className="press grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-secondary"
            >
              <Heart
                className={`h-4 w-4 ${e.favorite ? "fill-destructive text-destructive" : "text-muted-foreground"}`}
              />
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}
