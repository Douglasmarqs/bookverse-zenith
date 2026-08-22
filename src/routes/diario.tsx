import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookMarked, ChevronDown, Loader2, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useRequireAuth } from "@/hooks/use-require-auth";
import { describeFirestoreError } from "@/lib/async-utils";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import {
  addDiaryEntry,
  deleteDiaryEntry,
  subscribeDiary,
  DIARY_REACTIONS,
  type DiaryEntry,
  type DiaryReactionId,
} from "@/lib/diary";

export const Route = createFileRoute("/diario")({
  head: () => ({
    meta: [
      { title: "Diário de leitura — BookVerse" },
      {
        name: "description",
        content:
          "Registre como cada leitura te fez sentir: reações, comentários e um histórico vivo dos seus livros.",
      },
      { property: "og:title", content: "Diário de leitura — BookVerse" },
      {
        property: "og:description",
        content: "Reações e comentários sobre cada momento de leitura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuardedDiaryPage,
});

function GuardedDiaryPage() {
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
  return <DiaryPage uid={user.uid} />;
}

const REACTION_LABEL: Record<DiaryReactionId, { emoji: string; label: string }> = Object.fromEntries(
  DIARY_REACTIONS.map((r) => [r.id, { emoji: r.emoji, label: r.label }]),
) as Record<DiaryReactionId, { emoji: string; label: string }>;

function DiaryPage({ uid }: { uid: string }) {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  // form state
  const [bookId, setBookId] = useState<string>("");
  const [reaction, setReaction] = useState<DiaryReactionId>("amei");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubs = [subscribeDiary(uid, setEntries), subscribeLibrary(uid, setLibrary)];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const bookOptions = useMemo(() => {
    const sorted = [...library].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    return sorted;
  }, [library]);

  const selectedBook = bookOptions.find((b) => b.id === bookId) ?? null;

  async function onSave() {
    if (!selectedBook) {
      toast.error("Escolha um livro da sua estante para registrar.");
      return;
    }
    setSaving(true);
    try {
      await addDiaryEntry(uid, {
        bookTitle: selectedBook.title,
        bookAuthor: selectedBook.author,
        bookCover: selectedBook.cover ?? null,
        reaction,
        note,
      });
      toast.success("Momento registrado no diário · +10 XP");
      setNote("");
    } catch (err) {
      toast.error(describeFirestoreError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setRemovingId(id);
    try {
      await deleteDiaryEntry(uid, id);
      toast.success("Entrada removida.");
    } catch (err) {
      toast.error(describeFirestoreError(err));
    } finally {
      setRemovingId(null);
    }
  }

  const grouped = useMemo(() => {
    const list = entries ?? [];
    const fmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    const groups: { day: string; items: DiaryEntry[] }[] = [];
    for (const e of list) {
      const millis = e.createdAt?.toMillis?.();
      const day = millis ? fmt.format(new Date(millis)) : "Agora mesmo";
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(e);
      else groups.push({ day, items: [e] });
    }
    return groups;
  }, [entries]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Seu histórico</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">Diário de leitura</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Como foi a leitura de hoje? Registre a reação e um comentário — vira um histórico que conta
        a sua história como leitor.
      </p>

      {/* New entry */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <NotebookPen className="h-4 w-4 text-gold" />
          Novo registro
        </div>

        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Livro</span>
            <div className="relative mt-1.5">
              <select
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold/60"
              >
                <option value="">Escolha um livro da estante…</option>
                {bookOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} — {b.author}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>

          <div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Como foi?
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DIARY_REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReaction(r.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition ${
                    reaction === r.id
                      ? "border-gold/70 bg-gold/15 text-foreground"
                      : "border-border text-muted-foreground hover:border-gold/40"
                  }`}
                >
                  <span className="text-base leading-none">{r.emoji}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Comentário
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Capítulo 12 me pegou de surpresa — não consegui parar de ler…"
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-gold/60"
            />
          </label>

          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !bookId || !note.trim()}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-primary-foreground transition enabled:hover:scale-[1.02] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
            {saving ? "Salvando…" : "Registrar no diário"}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-12">
        {entries === null ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando diário…
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            Nenhum registro ainda. Seu primeiro momento de leitura aparece aqui.
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.day}>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  {group.day}
                </p>
                <div className="mt-3 space-y-3 border-l border-border/60 pl-5">
                  {group.items.map((e) => (
                    <article
                      key={e.id}
                      className="group relative rounded-2xl border border-border/60 bg-card/50 p-5"
                    >
                      <div className="flex items-start gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-xl">
                          {REACTION_LABEL[e.reaction]?.emoji ?? "📖"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {REACTION_LABEL[e.reaction]?.label ?? "Leitura"} em{" "}
                            <span className="text-gold-soft">{e.bookTitle}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{e.bookAuthor}</p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                            {e.note}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDelete(e.id)}
                          disabled={removingId === e.id}
                          aria-label="Apagar registro"
                          className="rounded-full p-2 text-muted-foreground/60 opacity-0 transition hover:text-destructive group-hover:opacity-100"
                        >
                          {removingId === e.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
