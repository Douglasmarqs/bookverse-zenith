/**
 * Diário de leitura — a journal that reads like one. The month's mood as a
 * ribbon of emotions, "neste dia" memories from earlier entries, a
 * composer in a sheet (pick the book by its cover, the feeling by a big
 * emoji, a line and the passage that stayed with you) and a timeline you
 * can filter by feeling or by book, share and tidy up.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, PenLine, Quote, RefreshCw, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { BookArt } from "@/components/book-art";
import { Lumi } from "@/components/brand/lumi";
import { TopBar } from "@/components/shell/top-bar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { describeFirestoreError } from "@/lib/async-utils";
import {
  addDiaryEntry,
  deleteDiaryEntry,
  subscribeDiary,
  DIARY_REACTIONS,
  type DiaryEntry,
  type DiaryReactionId,
} from "@/lib/diary";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";

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

/** A tone per feeling, used by the mood ribbon and the cards. */
const MOOD: Record<DiaryReactionId, { emoji: string; label: string; color: string }> = {
  amei: { emoji: "😍", label: "Amei", color: "#e5487a" },
  animado: { emoji: "🤩", label: "Empolgado", color: "#f2a33a" },
  rindo: { emoji: "😂", label: "Divertido", color: "#e9c93b" },
  pensativo: { emoji: "🤔", label: "Reflexivo", color: "#6d5df6" },
  frustrado: { emoji: "😤", label: "Frustrado", color: "#d9542b" },
  triste: { emoji: "😢", label: "Emocionado", color: "#3d8bd9" },
};

const PROMPTS = [
  "Que frase você levaria no bolso?",
  "Qual personagem você abraçaria — ou sacudiria?",
  "O que esse capítulo mudou no que você pensava?",
  "Se esse trecho tivesse uma trilha sonora, qual seria?",
  "Onde você estava quando leu isso?",
  "O que você contaria a um amigo sobre a leitura de hoje?",
  "Qual cena ainda está passando na sua cabeça?",
  "Você previu o que ia acontecer? Conta.",
];

const STATUS_ORDER: Record<string, number> = {
  lendo: 0,
  relendo: 1,
  "quero-ler": 2,
  concluido: 3,
  abandonado: 4,
};

function millis(e: DiaryEntry): number | null {
  return e.createdAt?.toMillis?.() ?? null;
}

function DiaryPage({ uid }: { uid: string }) {
  const reduce = useReducedMotion();
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [composing, setComposing] = useState(false);
  const [mood, setMood] = useState<DiaryReactionId | "all">("all");
  const [book, setBook] = useState<string | "all">("all");

  useEffect(() => {
    const unsubs = [subscribeDiary(uid, setEntries), subscribeLibrary(uid, setLibrary)];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const list = useMemo(() => entries ?? [], [entries]);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const month = useMemo(() => {
    const items = list.filter((e) => (millis(e) ?? Date.now()) >= monthStart);
    const counts = new Map<DiaryReactionId, number>();
    for (const e of items) counts.set(e.reaction, (counts.get(e.reaction) ?? 0) + 1);
    const days = new Set(items.map((e) => new Date(millis(e) ?? Date.now()).toDateString())).size;
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { items, counts: ranked, days, top: ranked[0]?.[0] ?? null };
  }, [list, monthStart]);

  const books = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list) m.set(e.bookTitle, (m.get(e.bookTitle) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [list]);

  /** An earlier entry from this same day of the month (or a week ago). */
  const memory = useMemo(() => {
    const today = now.getDate();
    const weekAgo = Date.now() - 7 * 86_400_000;
    return (
      list.find((e) => {
        const t = millis(e);
        if (!t) return false;
        const d = new Date(t);
        return d.getDate() === today && t < monthStart;
      }) ??
      list.find((e) => {
        const t = millis(e);
        return !!t && Math.abs(t - weekAgo) < 86_400_000;
      }) ??
      null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, monthStart]);

  const filtered = list.filter(
    (e) => (mood === "all" || e.reaction === mood) && (book === "all" || e.bookTitle === book),
  );

  const grouped = useMemo(() => {
    const fmtMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
    const groups: { label: string; items: DiaryEntry[] }[] = [];
    for (const e of filtered) {
      const t = millis(e);
      const label = t ? fmtMonth.format(new Date(t)) : "Agora mesmo";
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(e);
      else groups.push({ label, items: [e] });
    }
    return groups;
  }, [filtered]);

  const rise = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: d, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
        };

  const total = month.items.length;

  return (
    <div className="mx-auto max-w-3xl pb-28 lg:pt-10">
      <TopBar title="Diário" fallback="/perfil" className="mb-1" />

      {/* ── Mood of the month ────────────────────────────────────────── */}
      <motion.section
        {...rise(0)}
        className="relative mx-4 overflow-hidden rounded-[32px] p-5 text-white"
        style={{
          background: month.top
            ? `linear-gradient(140deg, #141414 30%, ${MOOD[month.top].color}cc)`
            : "#141414",
        }}
      >
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Seu mês em sentimentos
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[30px] leading-[1.05] tracking-[-0.03em]">
              {month.top ? `Um mês ${moodWord(month.top)}` : "Página em branco"}
            </p>
            <p className="mt-1.5 text-[13.5px] text-white/70">
              {total === 0
                ? "Seu primeiro registro do mês começa aqui."
                : `${total} ${total === 1 ? "registro" : "registros"} em ${month.days} ${month.days === 1 ? "dia" : "dias"}`}
            </p>
          </div>
          <motion.span
            key={month.top ?? "none"}
            initial={reduce ? false : { scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.2 }}
            className="text-[58px] leading-none"
            aria-hidden
          >
            {month.top ? MOOD[month.top].emoji : "📖"}
          </motion.span>
        </div>
        {total > 0 && (
          <>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
              {month.counts.map(([id, n], i) => (
                <motion.span
                  key={id}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${(n / total) * 100}%` }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: MOOD[id].color }}
                  className="h-full"
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
              {month.counts.map(([id, n]) => (
                <span key={id} className="num text-[12.5px] text-white/75">
                  {MOOD[id].emoji} {MOOD[id].label} · {Math.round((n / total) * 100)}%
                </span>
              ))}
            </div>
          </>
        )}
      </motion.section>

      {/* ── Prompt to write ──────────────────────────────────────────── */}
      <motion.button
        {...rise(0.06)}
        type="button"
        onClick={() => setComposing(true)}
        className="press surface-card mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3.5 rounded-[26px] p-4 text-left"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-primary-foreground">
          <PenLine className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15.5px] font-semibold">Como foi a leitura hoje?</span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {PROMPTS[now.getDate() % PROMPTS.length]}
          </span>
        </span>
      </motion.button>

      {/* ── On this day ──────────────────────────────────────────────── */}
      {memory && (
        <motion.section
          {...rise(0.1)}
          className="mx-4 mt-4 rounded-[26px] border border-dashed border-gold/50 bg-accent-soft/60 p-4"
        >
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-gold">
            Lembrança · {memoryWhen(memory)}
          </p>
          <p className="mt-1.5 text-[14.5px] leading-snug">
            {MOOD[memory.reaction]?.emoji} Em{" "}
            <span className="font-semibold">{memory.bookTitle}</span>, você escreveu:
          </p>
          <p className="mt-1 line-clamp-3 font-display text-[16px] italic leading-snug text-foreground/85">
            “{memory.quote || memory.note}”
          </p>
        </motion.section>
      )}

      {/* ── Filters ──────────────────────────────────────────────────── */}
      {list.length > 0 && (
        <motion.div {...rise(0.12)} className="mt-6">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip on={mood === "all"} onClick={() => setMood("all")}>
              Todos · {list.length}
            </Chip>
            {DIARY_REACTIONS.filter((r) => list.some((e) => e.reaction === r.id)).map((r) => (
              <Chip
                key={r.id}
                on={mood === r.id}
                onClick={() => setMood(mood === r.id ? "all" : r.id)}
              >
                {r.emoji} {r.label}
              </Chip>
            ))}
          </div>
          {books.length > 1 && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip small on={book === "all"} onClick={() => setBook("all")}>
                Todos os livros
              </Chip>
              {books.map((t) => (
                <Chip key={t} small on={book === t} onClick={() => setBook(book === t ? "all" : t)}>
                  {t}
                </Chip>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <div className="mt-5 px-4">
        {entries === null ? (
          <div className="flex items-center gap-3 px-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo seu diário…
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center rounded-[28px] bg-surface-2 px-6 py-10 text-center">
            <Lumi pose="idle" size={84} shadow={false} />
            <p className="mt-3 text-[16px] font-semibold">Seu diário está esperando</p>
            <p className="mt-1 max-w-[300px] text-[13.5px] text-muted-foreground">
              Cada registro guarda o livro, o que você sentiu e o trecho que ficou. Daqui a um ano,
              é a sua história de leitor.
            </p>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="press mt-4 h-11 rounded-full bg-foreground px-5 text-[14px] font-semibold text-background"
            >
              Escrever o primeiro
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 text-[14px] text-muted-foreground">Nenhum registro com esse filtro.</p>
        ) : (
          grouped.map((g) => (
            <section key={g.label} className="mb-6">
              <p className="sticky top-[calc(env(safe-area-inset-top)+3.25rem)] z-[1] -mx-1 mb-2 inline-block rounded-full bg-background/85 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
                {g.label}
              </p>
              <ol className="relative space-y-3 border-l-2 border-border/70 pl-4">
                <AnimatePresence initial={false}>
                  {g.items.map((e) => (
                    <EntryCard key={e.id} uid={uid} entry={e} />
                  ))}
                </AnimatePresence>
              </ol>
            </section>
          ))
        )}
      </div>

      {/* Floating write button */}
      {list.length > 0 &&
        !composing &&
        typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            aria-label="Novo registro"
            onClick={() => setComposing(true)}
            className="press fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-gold text-primary-foreground shadow-xl lg:bottom-10"
          >
            <PenLine className="h-6 w-6" />
          </button>,
          document.body,
        )}

      <Composer open={composing} onClose={() => setComposing(false)} uid={uid} library={library} />
    </div>
  );
}

function moodWord(id: DiaryReactionId): string {
  return {
    amei: "apaixonado",
    animado: "empolgante",
    rindo: "divertido",
    pensativo: "reflexivo",
    frustrado: "intenso",
    triste: "emocionante",
  }[id];
}

function memoryWhen(e: DiaryEntry): string {
  const t = millis(e);
  if (!t) return "há pouco";
  const days = Math.round((Date.now() - t) / 86_400_000);
  if (days <= 8) return "uma semana atrás";
  const months = Math.round(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"} atrás`;
  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? "ano" : "anos"} atrás`;
}

function Chip({
  on,
  onClick,
  small,
  children,
}: {
  on: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`press shrink-0 whitespace-nowrap rounded-full font-semibold ${
        small ? "h-8 max-w-[200px] truncate px-3 text-[12.5px]" : "h-9 px-3.5 text-[13.5px]"
      } ${on ? "bg-foreground text-background" : "bg-surface-2 text-foreground/80"}`}
    >
      {children}
    </button>
  );
}

function EntryCard({ uid, entry }: { uid: string; entry: DiaryEntry }) {
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const m = MOOD[entry.reaction] ?? MOOD.amei;
  const t = millis(entry);
  const when = t
    ? new Date(t).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }) +
      " · " +
      new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "agora mesmo";

  useEffect(() => {
    if (!confirm) return;
    const id = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(id);
  }, [confirm]);

  async function remove() {
    if (!confirm) return setConfirm(true);
    setRemoving(true);
    try {
      await deleteDiaryEntry(uid, entry.id);
      toast.success("Registro apagado.");
    } catch (err) {
      setRemoving(false);
      toast.error(describeFirestoreError(err, "Não foi possível apagar agora."));
    }
  }

  async function share() {
    const text = `${m.emoji} ${m.label} lendo “${entry.bookTitle}”, de ${entry.bookAuthor}.${
      entry.quote ? `\n\n“${entry.quote}”` : ""
    }${entry.note ? `\n\n${entry.note}` : ""}\n\n— meu diário no BookVerse`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Copiado para compartilhar.");
      }
    } catch {
      // cancelled
    }
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: removing ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -30, height: 0 }}
      className="relative"
    >
      <span
        aria-hidden
        className="absolute -left-[27px] top-5 grid h-5 w-5 place-items-center rounded-full text-[11px] ring-4 ring-background"
        style={{ background: m.color }}
      />
      <article className="surface-card overflow-hidden rounded-[24px]">
        <div className="h-1.5" style={{ background: m.color }} />
        <div className="flex gap-3.5 p-4">
          <div className="w-[52px] shrink-0">
            <BookArt title={entry.bookTitle} author={entry.bookAuthor} cover={entry.bookCover} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold">{entry.bookTitle}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">{entry.bookAuthor}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={{ background: `${m.color}22`, color: m.color }}
              >
                {m.emoji} {m.label}
              </span>
            </div>
            {entry.quote && (
              <blockquote
                data-selectable=""
                className="mt-3 border-l-[3px] pl-3 font-display text-[15.5px] italic leading-snug text-foreground/90"
                style={{ borderColor: m.color }}
              >
                “{entry.quote}”
              </blockquote>
            )}
            {entry.note && (
              <p
                data-selectable=""
                className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/85"
              >
                {entry.note}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="num text-[11.5px] capitalize text-faint">{when}</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Compartilhar registro"
                  onClick={() => void share()}
                  className="press grid h-9 w-9 place-items-center rounded-full text-muted-foreground"
                >
                  <Share2 className="h-[17px] w-[17px]" />
                </button>
                <button
                  type="button"
                  aria-label={confirm ? "Toque de novo para apagar" : "Apagar registro"}
                  onClick={() => void remove()}
                  disabled={removing}
                  className={`press flex h-9 items-center justify-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold ${
                    confirm ? "bg-destructive text-white" : "text-muted-foreground"
                  }`}
                >
                  {removing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-[17px] w-[17px]" />
                  )}
                  {confirm && "Apagar?"}
                </button>
              </span>
            </div>
          </div>
        </div>
      </article>
    </motion.li>
  );
}

function Composer({
  open,
  onClose,
  uid,
  library,
}: {
  open: boolean;
  onClose: () => void;
  uid: string;
  library: LibraryEntry[];
}) {
  const reduce = useReducedMotion();
  const books = useMemo(
    () =>
      [...library].sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
          a.title.localeCompare(b.title, "pt-BR"),
      ),
    [library],
  );
  const [bookId, setBookId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<DiaryReactionId>("amei");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState("");
  const [showQuote, setShowQuote] = useState(false);
  const [prompt, setPrompt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [burst, setBurst] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setPrompt(Math.floor(Math.random() * PROMPTS.length));
    if (!bookId && books[0]) setBookId(books[0].id);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = books.find((b) => b.id === bookId) ?? null;
  const canSave = !!selected && (note.trim() || quote.trim()) && !saving;

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await addDiaryEntry(uid, {
        bookTitle: selected.title,
        bookAuthor: selected.author,
        bookCover: selected.cover ?? null,
        reaction,
        note,
        quote,
      });
      navigator.vibrate?.([8, 40, 8]);
      setBurst((b) => b + 1);
      toast.success(`${MOOD[reaction].emoji} Guardado no diário · +10 XP`);
      setNote("");
      setQuote("");
      setShowQuote(false);
      setTimeout(onClose, reduce ? 0 : 650);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar agora. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Novo registro no diário"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[92dvh] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-t-[30px] bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-foreground/15" />
            <div className="flex items-center justify-between">
              <p className="font-display text-[22px]">Novo registro</p>
              <button
                type="button"
                aria-label="Fechar"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-surface-2"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Qual livro?
            </p>
            {books.length === 0 ? (
              <div className="rounded-[18px] bg-surface-2 p-4 text-[13.5px] text-muted-foreground">
                Sua estante está vazia.{" "}
                <Link to="/descobrir" className="font-semibold text-gold" onClick={onClose}>
                  Encontre um livro
                </Link>{" "}
                para começar o diário.
              </div>
            ) : (
              <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto scroll-pl-5 px-5 pb-1 pt-1">
                {books.map((b) => {
                  const on = b.id === bookId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBookId(b.id)}
                      aria-pressed={on}
                      aria-label={b.title}
                      className="w-[68px] shrink-0 snap-start text-left"
                    >
                      <motion.div
                        animate={{ y: on ? -4 : 0, scale: on ? 1.04 : 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 26 }}
                        className={`rounded-[10px] ${on ? "ring-[3px] ring-gold ring-offset-2 ring-offset-card" : "opacity-75"}`}
                      >
                        <BookArt
                          title={b.title}
                          author={b.author}
                          cover={b.cover}
                          showText={false}
                        />
                      </motion.div>
                      <p
                        className={`mt-1.5 line-clamp-2 text-[11px] leading-tight ${on ? "font-semibold" : "text-muted-foreground"}`}
                      >
                        {b.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Como você ficou?
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {DIARY_REACTIONS.map((r) => {
                const on = reaction === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setReaction(r.id);
                      navigator.vibrate?.(6);
                    }}
                    aria-pressed={on}
                    className="flex flex-col items-center gap-1 rounded-[16px] py-2"
                    style={on ? { background: `${MOOD[r.id].color}22` } : undefined}
                  >
                    <motion.span
                      animate={
                        on && !reduce
                          ? { scale: [1, 1.35, 1.15], rotate: [0, -10, 0] }
                          : { scale: on ? 1.15 : 1 }
                      }
                      transition={{ duration: 0.45 }}
                      className={`text-[28px] leading-none ${on ? "" : "grayscale-[0.6] opacity-70"}`}
                    >
                      {r.emoji}
                    </motion.span>
                    <span
                      className={`text-[10.5px] font-semibold ${on ? "" : "text-muted-foreground"}`}
                      style={on ? { color: MOOD[r.id].color } : undefined}
                    >
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mb-2 mt-5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Conte
              </p>
              <button
                type="button"
                onClick={() => {
                  setPrompt((p) => (p + 1) % PROMPTS.length);
                  noteRef.current?.focus();
                }}
                className="flex items-center gap-1 text-[12.5px] font-semibold text-gold"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Outra ideia
              </button>
            </div>
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={PROMPTS[prompt]}
              className="w-full resize-none rounded-[18px] bg-surface-2 px-4 py-3 text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-gold/50"
            />
            <div className="mt-1 text-right text-[11px] text-faint">{note.length}/1000</div>

            <AnimatePresence initial={false}>
              {showQuote ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="mb-2 mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Trecho que marcou
                  </p>
                  <textarea
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder="Cole ou escreva a frase do livro…"
                    className="w-full resize-none rounded-[18px] bg-surface-2 px-4 py-3 font-display text-[16px] italic leading-snug outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-gold/50"
                  />
                </motion.div>
              ) : (
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowQuote(true)}
                  className="mt-1 flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground"
                >
                  <Quote className="h-4 w-4" /> Guardar um trecho do livro
                </motion.button>
              )}
            </AnimatePresence>

            <div className="relative mt-5">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!canSave}
                className="press flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-[18px] leading-none">{MOOD[reaction].emoji}</span>
                )}
                {saving ? "Guardando…" : "Guardar no diário"}
              </button>
              <EmojiBurst key={burst} emoji={MOOD[reaction].emoji} active={burst > 0 && !reduce} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** A little fountain of the chosen feeling when an entry is saved. */
function EmojiBurst({ emoji, active }: { emoji: string; active: boolean }) {
  if (!active) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI - Math.PI;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: Math.cos(a) * 120, y: Math.sin(a) * 90 - 20, opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="absolute text-[22px]"
          >
            {emoji}
          </motion.span>
        );
      })}
    </div>
  );
}
