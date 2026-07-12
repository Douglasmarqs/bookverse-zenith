import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, BookOpen } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { removeFromLibrary, setLibraryStatus, subscribeLibrary, type LibraryEntry, type LibraryStatus } from "@/lib/library";

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
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);

  useEffect(() => subscribeLibrary(uid, setEntries), [uid]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Minha biblioteca</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Seus livros</h1>

      {entries === null ? (
        <div className="mt-16 h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      ) : entries.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <p className="text-muted-foreground">Sua biblioteca está vazia por enquanto.</p>
          <Link
            to="/descobrir"
            search={{ q: undefined, categoria: undefined }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Descobrir livros
          </Link>
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
                <select
                  value={entry.status}
                  onChange={(e) => setLibraryStatus(uid, entry.id, e.target.value as LibraryStatus)}
                  className="mt-3 rounded-full border border-border bg-background px-2.5 py-1 text-xs outline-none"
                >
                  {(Object.keys(STATUS_LABEL) as LibraryStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeFromLibrary(uid, entry.id)}
                  className="mt-3 ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
