import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Trash2,
  BookOpen,
  BookOpenCheck,
  ArrowUpRight,
  Loader2,
  UploadCloud,
  FileUp,
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
import { parseEpubFile } from "@/lib/epub-parser";
import { deleteEpubBook, isEpubReaderId, saveEpubBook } from "@/lib/epub-store";

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
};

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
    // On success the entry disappears via the live subscription, so no
    // need to clear `busy` for `id` in that branch.
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const book = await parseEpubFile(file);
      await saveEpubBook(book);
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

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Minha biblioteca</p>
          <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Seus livros</h1>
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

      {entries === null ? (
        <div className="mt-16 h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
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
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-border/60 bg-card/60 p-4"
            >
              {entry.cover ? (
                <img
                  src={entry.cover}
                  alt={entry.title}
                  className="book-shadow h-28 w-20 rounded-md object-cover"
                />
              ) : (
                <div className="book-shadow grid h-28 w-20 place-items-center rounded-md bg-secondary p-1 text-center">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-base font-medium">{entry.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{entry.author}</p>
                {entry.readerId && isEpubReaderId(entry.readerId) && (
                  <span className="mt-1 inline-block rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                    Arquivo local (EPUB)
                  </span>
                )}

                {entry.readerId ? (
                  <Link
                    to="/reader/$bookId"
                    params={{ bookId: entry.readerId }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    <BookOpenCheck className="h-3 w-3" />
                    {entry.status === "concluido" ? "Reler" : "Continuar lendo"}
                  </Link>
                ) : (
                  <Link
                    to="/livro/$slug"
                    params={{ slug: slugFor(entry.title, entry.author) || "livro" }}
                    search={{ title: entry.title, author: entry.author }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs hover:border-gold/40 hover:text-gold"
                  >
                    <ArrowUpRight className="h-3 w-3" /> Ver detalhes
                  </Link>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={entry.status}
                    disabled={busy.has(entry.id)}
                    onChange={(e) => handleStatusChange(entry.id, e.target.value as LibraryStatus)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs outline-none disabled:opacity-60"
                  >
                    {(Object.keys(STATUS_LABEL) as LibraryStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemove(entry)}
                    disabled={busy.has(entry.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
                  >
                    {busy.has(entry.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
