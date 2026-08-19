import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  BookOpen,
  BookOpenCheck,
  ArrowUpRight,
  Loader2,
  UploadCloud,
  FileUp,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { describeFirestoreError } from "@/lib/async-utils";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  addToLibrary,
  removeFromLibrary,
  setLibraryStatus,
  slugFor,
  subscribeLibrary,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/library";
import {
  deleteEpubBook,
  isEpubReaderId,
  saveEpubBook,
  uploadEpubBookToCloud,
} from "@/lib/epub-store";

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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => subscribeLibrary(uid, setEntries), [uid]);

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
      await removeFromLibrary(uid, entry.id);
      if (entry.readerId && isEpubReaderId(entry.readerId)) {
        void deleteEpubBook(entry.readerId).catch(() => {});
      }
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
      // Lazy-loaded: jszip is a sizeable dependency that only readers who
      // actually use "Adicionar EPUB" should pay the download cost for.
      const { parseEpubFile } = await import("@/lib/epub-parser");
      const book = await parseEpubFile(file);
      await saveEpubBook(book);
      // Mirror to the cloud (best effort) so the same book opens on other devices.
      void uploadEpubBookToCloud(uid, book);
      await addToLibrary(
        uid,
        { title: book.title, author: book.author, cover: book.cover, readerId: book.id },
        "quero-ler",
      );
      toast.success(`"${book.title}" adicionado à sua biblioteca.`, {
        action: {
          label: "Ler agora",
          onClick: () => navigate({ to: "/reader/$bookId", params: { bookId: book.id } }),
        },
      });
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível importar este EPUB."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const counts = useMemo(() => {
    const c = { todos: entries?.length ?? 0, "quero-ler": 0, lendo: 0, concluido: 0 };
    for (const e of entries ?? []) c[e.status] += 1;
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    let list = entries ?? [];
    if (filter !== "todos") list = list.filter((e) => e.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) => e.title.toLowerCase().includes(q) || e.author.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    else if (sort === "author") sorted.sort((a, b) => a.author.localeCompare(b.author, "pt-BR"));
    // "recent" relies on Firestore's natural order (addedAt-ish) already
    // present in `entries` — no client re-sort needed.
    return sorted;
  }, [entries, filter, query, sort]);

  const SORT_LABEL: Record<SortKey, string> = {
    recent: "Adicionados recentemente",
    title: "Título (A–Z)",
    author: "Autor (A–Z)",
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Minha biblioteca</p>
          <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Seus livros</h1>
          {entries && entries.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {counts.todos} {counts.todos === 1 ? "livro" : "livros"} · {counts.lendo} lendo ·{" "}
              {counts.concluido} concluído{counts.concluido === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-2.5 text-sm font-medium text-gold hover:bg-gold/10 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {uploading ? "Importando…" : "Adicionar EPUB"}
          </button>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Importe um arquivo <code className="font-mono">.epub</code> do seu computador para ler aqui
        mesmo, com a mesma experiência de leitura dos outros livros. O arquivo fica salvo neste
        navegador — se quiser lê-lo em outro dispositivo, importe-o novamente lá.
      </p>

      {entries && entries.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "lendo", "quero-ler", "concluido"] as FilterTab[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  filter === f
                    ? "bg-gold text-primary-foreground"
                    : "border border-border/60 text-foreground/75 hover:border-gold/40 hover:text-foreground"
                }`}
              >
                {f === "todos" ? "Todos" : STATUS_LABEL[f]} · {counts[f]}
              </button>
            ))}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:ml-auto">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 sm:flex-none">
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

            <div className="relative shrink-0">
              <button
                onClick={() => setSortMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs text-foreground/75 hover:text-foreground"
              >
                <span className="sm:hidden">Ordenar</span>
                <span className="hidden sm:inline">{SORT_LABEL[sort]}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {sortMenuOpen && (
                <div
                  className="absolute right-0 z-10 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl"
                  onMouseLeave={() => setSortMenuOpen(false)}
                >
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSort(s);
                        setSortMenuOpen(false);
                      }}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs ${
                        sort === s ? "bg-gold/10 text-gold" : "hover:bg-secondary"
                      }`}
                    >
                      {SORT_LABEL[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
        <div className="mt-10 rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <FileUp className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Sua biblioteca está vazia por enquanto.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/descobrir"
              search={{ q: undefined, categoria: undefined }}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Descobrir livros
            </Link>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm hover:border-gold/40 hover:text-gold"
            >
              Ou importe um EPUB
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <Search className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">
            {query
              ? `Nenhum resultado para "${query}".`
              : `Nenhum livro em "${STATUS_LABEL[filter as LibraryStatus] ?? filter}" ainda.`}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((entry) => (
            <BookCard
              key={entry.id}
              entry={entry}
              busy={busy.has(entry.id)}
              onStatusChange={(status) => handleStatusChange(entry.id, status)}
              onRemove={() => handleRemove(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({
  entry,
  busy,
  onStatusChange,
  onRemove,
}: {
  entry: LibraryEntry;
  busy: boolean;
  onStatusChange: (status: LibraryStatus) => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const primaryHref = entry.readerId
    ? { to: "/reader/$bookId" as const, params: { bookId: entry.readerId } }
    : {
        to: "/livro/$slug" as const,
        params: { slug: slugFor(entry.title, entry.author) || "livro" },
        search: { title: entry.title, author: entry.author },
      };

  return (
    <div className="group relative">
      <Link {...primaryHref} className="block">
        <div className="relative">
          {entry.cover ? (
            <img
              src={entry.cover}
              alt={entry.title}
              loading="lazy"
              className="book-shadow aspect-[2/3] w-full rounded-lg object-cover transition-transform duration-300 group-hover:-translate-y-1"
            />
          ) : (
            <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-lg bg-secondary p-3 text-center transition-transform duration-300 group-hover:-translate-y-1">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
              entry.status === "concluido"
                ? "bg-emerald-500/85 text-white"
                : entry.status === "lendo"
                  ? "bg-gold/90 text-primary-foreground"
                  : "bg-background/85 text-foreground ring-1 ring-border/60"
            }`}
          >
            {STATUS_LABEL[entry.status]}
          </span>

          {entry.readerId && isEpubReaderId(entry.readerId) && (
            <span className="absolute right-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[9px] font-medium text-foreground/80 ring-1 ring-border/60 backdrop-blur-sm">
              EPUB local
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

      <div className="mt-3 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <Link
            {...primaryHref}
            className="block truncate font-display text-sm font-medium hover:text-gold"
          >
            {entry.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.author}</p>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy}
            aria-label="Mais opções"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreDots />}
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 z-10 mt-1 w-40 max-w-[calc(100vw-2rem)] rounded-xl border border-border/60 bg-background/95 p-1.5 text-xs shadow-xl backdrop-blur-xl"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <p className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Mover para
              </p>
              {(Object.keys(STATUS_LABEL) as LibraryStatus[])
                .filter((s) => s !== entry.status)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onStatusChange(s);
                      setMenuOpen(false);
                    }}
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-secondary"
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              <div className="my-1 h-px bg-border/60" />
              <button
                onClick={() => {
                  onRemove();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" /> Remover
              </button>
            </div>
          )}
        </div>
      </div>
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
