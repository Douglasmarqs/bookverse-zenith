/**
 * Metas — the year as a ring of twelve months, a shelf with a slot for
 * every book you promised yourself, the pace you need, today's minutes
 * and the next milestones. Everything is derived from what was really
 * read: the library ("Concluídos", with the date each book was finished)
 * and the reading ritual (active minutes per day).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookCheck,
  Check,
  FileText,
  Flame,
  Library,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { BookArt } from "@/components/book-art";
import { Lumi } from "@/components/brand/lumi";
import { TopBar } from "@/components/shell/top-bar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  ACHIEVEMENTS,
  achievementProgress,
  isUnlocked,
  type AchievementCategory,
  type AchievementStats,
} from "@/lib/achievements";
import { describeFirestoreError } from "@/lib/async-utils";
import {
  computeGoalProgress,
  currentYear,
  saveReadingGoal,
  subscribeReadingGoal,
  type ReadingGoal,
} from "@/lib/goals";
import { slugFor, subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { getLocalOnboarding, loadOnboarding, saveOnboarding } from "@/lib/onboarding";
import { dayKey, useRitual } from "@/lib/ritual";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas e hábitos de leitura — BookVerse" },
      {
        name: "description",
        content:
          "Defina sua meta anual de livros, acompanhe sua sequência de dias lendo e veja o ritmo necessário para bater o desafio.",
      },
      { property: "og:title", content: "Metas e hábitos de leitura — BookVerse" },
      {
        property: "og:description",
        content: "Meta anual, sequência de leitura e progresso das suas estantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuardedMetasPage,
});

const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const PRESETS = [6, 12, 24, 52];
const DAILY = [10, 20, 30, 45, 60];
const LIME = "#d7f53a";

const CAT: Record<AchievementCategory, { icon: typeof Flame; bg: string; fg: string }> = {
  sequencia: { icon: Flame, bg: "var(--accent-soft)", fg: "#e0431a" },
  leitura: { icon: BookCheck, bg: "var(--mint)", fg: "#1f8a52" },
  capitulos: { icon: FileText, bg: "var(--lilac)", fg: "#5b4be0" },
  biblioteca: { icon: Library, bg: "var(--sky)", fg: "#2563c9" },
};

function ambition(n: number): { label: string; line: string } {
  if (n <= 4) return { label: "Sem pressa", line: "Um livro por estação. Leitura sem culpa." };
  if (n <= 8) return { label: "Leve", line: "Cabe em qualquer rotina — até nas corridas." };
  if (n <= 15) return { label: "Constante", line: "Um por mês: o ritmo dos leitores de verdade." };
  if (n <= 30) return { label: "Ambiciosa", line: "Dois por mês. Você vai virar referência." };
  if (n <= 55) return { label: "Um por semana", line: "Nível clube do livro. Respeito." };
  return { label: "Lendária", line: "Isso é quase uma biblioteca por ano." };
}

function GuardedMetasPage() {
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
  return <MetasPage uid={user.uid} />;
}

/** Counts up to `value` once it is on screen. */
function useCountUp(value: number, ms = 900) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) return setN(value);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setN(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduce]);
  return n;
}

function MetasPage({ uid }: { uid: string }) {
  const reduce = useReducedMotion();
  const year = currentYear();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goal, setGoal] = useState<ReadingGoal | null | undefined>(undefined);
  const [draft, setDraft] = useState(12);
  const [saving, setSaving] = useState(false);
  const ritual = useRitual(uid);
  const [daily, setDaily] = useState<number>(() => getLocalOnboarding(uid)?.dailyMinutes ?? 20);

  useEffect(() => subscribeLibrary(uid, setEntries), [uid]);
  useEffect(() => subscribeUserProfile(uid, setProfile), [uid]);
  useEffect(() => subscribeReadingGoal(uid, year, setGoal), [uid, year]);
  useEffect(() => {
    if (goal) setDraft(goal.books);
  }, [goal]);

  const target = goal?.books ?? 12;
  const progress = useMemo(
    () => computeGoalProgress(entries, target, year),
    [entries, target, year],
  );
  const dirty = draft !== target || goal === null;
  const done = useCountUp(progress.completed);

  const stats: AchievementStats = useMemo(
    () => ({
      booksCompleted: profile?.booksCompleted ?? 0,
      chaptersRead: profile?.chaptersRead ?? 0,
      currentStreak: profile?.currentStreak ?? 0,
      longestStreak: profile?.longestStreak ?? 0,
      libraryCount: entries.length,
    }),
    [profile, entries.length],
  );
  const nextMilestones = useMemo(
    () =>
      ACHIEVEMENTS.filter((a) => !isUnlocked(a, stats))
        .map((a) => ({ a, p: achievementProgress(a, stats) }))
        .sort((x, y) => y.p - x.p)
        .slice(0, 3),
    [stats],
  );

  const status =
    progress.remaining === 0
      ? { tone: LIME, text: "Meta batida! 🎉" }
      : progress.delta > 0
        ? { tone: LIME, text: `${progress.delta} à frente do ritmo` }
        : progress.delta === 0
          ? { tone: "#ffffff", text: "Exatamente no ritmo" }
          : { tone: "#ffb37a", text: `${-progress.delta} atrás — dá pra virar` };

  async function handleSave() {
    setSaving(true);
    try {
      await saveReadingGoal(uid, year, draft);
      navigator.vibrate?.(10);
      toast.success(`Meta de ${draft} livros para ${year} salva.`);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar sua meta."));
    } finally {
      setSaving(false);
    }
  }

  async function changeDaily(minutes: number) {
    setDaily(minutes);
    navigator.vibrate?.(8);
    try {
      const prefs = getLocalOnboarding(uid) ?? (await loadOnboarding(uid));
      await saveOnboarding(uid, {
        genres: prefs?.genres ?? [],
        moment: prefs?.moment ?? "qualquer",
        completedAt: prefs?.completedAt ?? Date.now(),
        dailyMinutes: minutes,
      });
      toast.success(`Meta diária: ${minutes} minutos.`);
    } catch {
      toast.error("Não foi possível salvar a meta diária agora.");
    }
  }

  const step = (d: number) => {
    setDraft((v) => Math.max(1, Math.min(365, v + d)));
    navigator.vibrate?.(6);
  };

  const rise = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: d, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
        };

  const today = ritual.todayMinutes;
  const todayPct = Math.min(1, today / Math.max(1, daily));
  const streak = profile?.currentStreak ?? 0;
  const record = Math.max(profile?.longestStreak ?? 0, streak);
  const amb = ambition(draft);

  return (
    <div className="mx-auto max-w-3xl pb-12 lg:max-w-5xl lg:pt-10">
      <TopBar title="Metas" fallback="/perfil" className="mb-1" />

      <div className="lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-5 lg:px-4">
        {/* ── The year ring ─────────────────────────────────────────── */}
        <motion.section
          {...rise(0)}
          className="relative mx-4 overflow-hidden rounded-[32px] bg-[#121212] px-5 pb-6 pt-5 text-white lg:mx-0"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(circle, #d7f53a55, transparent 70%)" }}
          />
          <div className="flex items-center justify-between">
            <span className="inline-flex rounded-full bg-[#d7f53a] px-3 py-1 text-[12.5px] font-bold text-[#131313]">
              Desafio {year}
            </span>
            <span className="num text-[12.5px] text-white/55">
              {progress.daysLeft} dias restantes
            </span>
          </div>

          <YearRing byMonth={progress.byMonth} target={target} reduce={!!reduce}>
            <p className="num font-display text-[56px] leading-none tracking-[-0.04em]">
              {done}
              <span className="text-[26px] text-white/45">/{target}</span>
            </p>
            <p className="mt-1.5 text-[13px] text-white/60">livros em {year}</p>
          </YearRing>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold"
              style={{ color: status.tone }}
            >
              <TrendingUp className="h-4 w-4" /> {status.text}
            </span>
            {progress.daysPerBook && (
              <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] text-white/75">
                1 livro a cada {progress.daysPerBook} {progress.daysPerBook === 1 ? "dia" : "dias"}
              </span>
            )}
          </div>
        </motion.section>

        <div>
          {/* ── Goal editor ──────────────────────────────────────────── */}
          <motion.section
            {...rise(0.06)}
            className="surface-card mx-4 mt-4 rounded-[28px] p-5 lg:mx-0 lg:mt-0"
          >
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-bold tracking-[-0.01em]">Sua meta</p>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={amb.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-gold"
                >
                  {amb.label}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Menos um livro"
                onClick={() => step(-1)}
                className="press grid h-14 w-14 place-items-center rounded-full bg-surface-2"
              >
                <Minus className="h-5 w-5" strokeWidth={2.4} />
              </button>
              <div className="min-w-0 text-center">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={draft}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 520, damping: 30 }}
                    className="num font-display text-[52px] leading-none tracking-[-0.04em]"
                  >
                    {draft}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-[12.5px] text-muted-foreground">livros no ano</p>
              </div>
              <button
                type="button"
                aria-label="Mais um livro"
                onClick={() => step(1)}
                className="press grid h-14 w-14 place-items-center rounded-full bg-foreground text-background"
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
            <p className="mt-3 text-center text-[13px] text-muted-foreground">{amb.line}</p>
            <div className="mt-4 flex justify-center gap-2">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDraft(n)}
                  aria-pressed={draft === n}
                  className={`press num h-9 rounded-full px-3.5 text-[13.5px] font-semibold ${
                    draft === n ? "bg-foreground text-background" : "bg-surface-2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {dirty && goal !== undefined && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 48, marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gold text-[14.5px] font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {goal === null ? `Assumir a meta de ${draft}` : `Salvar ${draft} livros`}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.section>

          {/* ── Forecast ─────────────────────────────────────────────── */}
          <motion.section
            {...rise(0.1)}
            className="surface-card mx-4 mt-4 rounded-[28px] p-5 lg:mx-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[17px] font-bold tracking-[-0.01em]">Previsão</p>
              <p className="num text-[13px] text-muted-foreground">real × ideal</p>
            </div>
            <p className="mt-1 text-[14px] text-muted-foreground">
              No seu ritmo, você fecha {year} com{" "}
              <span className="font-semibold text-foreground">
                {progress.projected} {progress.projected === 1 ? "livro" : "livros"}
              </span>
              {progress.projected >= target ? " — acima da meta." : "."}
            </p>
            <PaceChart byMonth={progress.byMonth} target={target} />
          </motion.section>
        </div>
      </div>

      {/* ── The year's shelf ─────────────────────────────────────────── */}
      <motion.section {...rise(0.14)} className="mt-7">
        <div className="mx-[22px] mb-3 flex items-baseline justify-between">
          <h2 className="text-[22px]">A estante de {year}</h2>
          <span className="num text-[13.5px] font-semibold text-muted-foreground">
            {progress.completed} de {target}
          </span>
        </div>
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-pl-4 px-4 pb-2">
          {progress.books.map((b, i) => (
            <Link
              key={b.id}
              to={b.readerId ? "/reader/$bookId" : "/livro/$slug"}
              params={b.readerId ? { bookId: b.readerId } : { slug: slugFor(b.title, b.author) }}
              search={b.readerId ? undefined : { title: b.title, author: b.author }}
              className="press w-[92px] shrink-0 snap-start"
            >
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 18, rotate: -4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{
                  delay: 0.15 + Math.min(i, 10) * 0.05,
                  type: "spring",
                  stiffness: 260,
                  damping: 22,
                }}
              >
                <BookArt title={b.title} author={b.author} cover={b.cover} />
              </motion.div>
              <p className="mt-1.5 line-clamp-1 text-[12px] font-semibold">{b.title}</p>
              <p className="num text-[11px] text-faint">
                {b.completedAt ? MONTHS_SHORT[new Date(b.completedAt).getMonth()] : "lido"}
              </p>
            </Link>
          ))}
          {Array.from({ length: Math.min(progress.remaining, 12) }, (_, i) => (
            <Link
              key={`slot-${i}`}
              to="/descobrir"
              className="press grid aspect-[2/3] w-[92px] shrink-0 snap-start place-items-center rounded-[10px] border-2 border-dashed border-border text-faint"
              aria-label="Encontrar o próximo livro"
            >
              <span className="text-center">
                <Plus className="mx-auto h-5 w-5" />
                <span className="num mt-1 block text-[11px] font-semibold">
                  {progress.completed + i + 1}º
                </span>
              </span>
            </Link>
          ))}
          {progress.remaining > 12 && (
            <div className="grid aspect-[2/3] w-[92px] shrink-0 place-items-center rounded-[10px] bg-surface-2 text-center text-[12px] font-semibold text-muted-foreground">
              +{progress.remaining - 12}
              <br />
              vagas
            </div>
          )}
        </div>
        {progress.completed === 0 && (
          <p className="mx-[22px] mt-1 text-[13px] text-muted-foreground">
            Cada livro que você terminar ocupa uma vaga. Marque como “Concluído” na Biblioteca — ou
            termine pelo leitor.
          </p>
        )}
      </motion.section>

      <div className="mt-3 grid gap-4 px-4 lg:grid-cols-2">
        {/* ── Today ──────────────────────────────────────────────────── */}
        <motion.section {...rise(0.18)} className="surface-card rounded-[28px] p-5">
          <div className="flex items-center gap-4">
            <MiniRing value={todayPct} size={86} stroke={9} color="var(--gold)">
              <Timer className="h-5 w-5 text-gold" />
            </MiniRing>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Hoje
              </p>
              <p className="num font-display text-[30px] leading-tight tracking-[-0.03em]">
                {Math.floor(today)}
                <span className="text-[18px] text-muted-foreground"> / {daily} min</span>
              </p>
              <p className="text-[13px] text-muted-foreground">
                {todayPct >= 1
                  ? "Meta diária cumprida. ✨"
                  : today > 0
                    ? `Faltam ${Math.ceil(daily - today)} min — um capítulo curto resolve.`
                    : "Abra um livro: até 2 páginas mantêm a sequência."}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {ritual.week.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1">
                <MiniRing
                  value={Math.min(1, d.minutes / Math.max(1, daily))}
                  size={34}
                  stroke={4}
                  color={
                    d.minutes >= daily
                      ? "var(--gold)"
                      : "color-mix(in srgb, var(--gold) 55%, transparent)"
                  }
                >
                  {d.minutes >= daily && <Check className="h-3 w-3 text-gold" strokeWidth={3} />}
                </MiniRing>
                <span
                  className={`text-[11px] font-semibold ${d.today ? "text-foreground" : "text-faint"}`}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Minutos por dia
          </p>
          <div className="flex gap-1.5">
            {DAILY.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => void changeDaily(m)}
                aria-pressed={daily === m}
                className={`press num h-9 flex-1 rounded-full text-[13px] font-semibold ${
                  daily === m ? "bg-foreground text-background" : "bg-surface-2"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── Streak ─────────────────────────────────────────────────── */}
        <motion.section
          {...rise(0.22)}
          className="surface-card relative overflow-hidden rounded-[28px] p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Sequência
              </p>
              <p className="num font-display text-[44px] leading-none tracking-[-0.04em]">
                {streak}
                <span className="ml-1.5 text-[18px] text-muted-foreground">
                  {streak === 1 ? "dia" : "dias"}
                </span>
              </p>
            </div>
            <motion.span
              aria-hidden
              animate={
                reduce || streak === 0 ? undefined : { scale: [1, 1.12, 1], rotate: [0, -4, 0] }
              }
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="grid h-14 w-14 place-items-center rounded-[18px]"
              style={{
                background: "var(--accent-soft)",
                color: streak ? "#e0431a" : "var(--faint)",
              }}
            >
              <Flame className="h-7 w-7" strokeWidth={2.2} />
            </motion.span>
          </div>
          <StreakChain days={ritual.days} />
          <p className="mt-3 text-[13.5px] text-muted-foreground">
            {streak === 0
              ? "Leia hoje para acender a chama."
              : streak >= record
                ? `Recorde pessoal! Cada dia agora é história.`
                : `Recorde: ${record} dias — faltam ${record - streak + 1} para superar.`}
          </p>
          {ritual.todayMinutes === 0 && streak > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Leia hoje para não perder a sequência
            </p>
          )}
        </motion.section>
      </div>

      {/* ── Next milestones ─────────────────────────────────────────── */}
      {nextMilestones.length > 0 && (
        <motion.section {...rise(0.26)} className="mt-7">
          <div className="mx-[22px] mb-3 flex items-baseline justify-between">
            <h2 className="text-[22px]">Quase lá</h2>
            <Link to="/desafios" className="text-[13.5px] font-semibold text-gold">
              Todas as conquistas
            </Link>
          </div>
          <div className="mx-4 grid gap-2.5 lg:grid-cols-3">
            {nextMilestones.map(({ a, p }) => {
              const c = CAT[a.category];
              const Icon = c.icon;
              const current = a.metric(stats);
              return (
                <div
                  key={a.id}
                  className="surface-card flex items-center gap-3.5 rounded-[22px] p-4"
                >
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-[15px]"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14.5px] font-semibold">{a.title}</p>
                      <span className="num shrink-0 text-[12px] text-muted-foreground">
                        {Math.min(current, a.threshold)}/{a.threshold}
                      </span>
                    </div>
                    <p className="truncate text-[12.5px] text-muted-foreground">{a.description}</p>
                    <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-surface-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(4, Math.round(p * 100))}%` }}
                        transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ background: c.fg }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      <div className="mx-4 mt-7 flex items-center gap-3 rounded-[24px] bg-surface-2 p-4">
        <Lumi pose="idle" size={52} shadow={false} />
        <p className="text-[13.5px] leading-snug text-muted-foreground">
          {progress.remaining === 0
            ? "Meta batida. Quer subir a régua? Aumente a meta — eu guardo as vagas novas na estante."
            : progress.delta < 0
              ? `Um conto ou uma novela curta conta como livro. Experimente “O Alienista” — dá pra terminar em uma tarde.`
              : `Você está indo muito bem. Mantenha ${daily} minutos por dia e a meta vem sozinha.`}
        </p>
      </div>
    </div>
  );
}

/** Twelve arcs, one per month, filled by the books finished that month. */
function YearRing({
  byMonth,
  target,
  reduce,
  children,
}: {
  byMonth: number[];
  target: number;
  reduce: boolean;
  children: React.ReactNode;
}) {
  const [drawn, setDrawn] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [reduce]);
  const size = 250;
  const r = 104;
  const c = 2 * Math.PI * r;
  const gap = 7;
  const seg = c / 12 - gap;
  const perMonth = target / 12;
  const now = new Date().getMonth();
  return (
    <div className="relative mx-auto my-3 grid aspect-square w-full max-w-[260px] place-items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full -rotate-90">
        {byMonth.map((n, i) => {
          const fill = perMonth > 0 ? Math.min(1, n / perMonth) : 0;
          const rot = (i * 360) / 12;
          return (
            <g key={i} transform={`rotate(${rot} ${size / 2} ${size / 2})`}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={i > now ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.14)"}
                strokeWidth={16}
                strokeLinecap="round"
                strokeDasharray={`${seg} ${c}`}
              />
              {fill > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={LIME}
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeDasharray={`${drawn ? seg * fill : 0.01} ${c}`}
                  style={{
                    transition: "stroke-dasharray 900ms cubic-bezier(.16,1,.3,1)",
                    transitionDelay: `${150 + i * 60}ms`,
                  }}
                />
              )}
              {i === now && (
                <circle
                  cx={size / 2 + r}
                  cy={size / 2}
                  r={4}
                  fill="#fff"
                  className={reduce ? "" : "animate-pulse"}
                  transform={`rotate(${(seg / c) * 180} ${size / 2} ${size / 2})`}
                />
              )}
            </g>
          );
        })}
      </svg>
      {MONTHS_SHORT.map((m, i) => {
        const a = ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + Math.cos(a) * 32;
        const y = 50 + Math.sin(a) * 32;
        return (
          <span
            key={m}
            aria-hidden
            className={`absolute -translate-x-1/2 -translate-y-1/2 text-[9.5px] font-semibold uppercase ${
              i === now ? "text-white" : "text-white/35"
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {m[0]}
          </span>
        );
      })}
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/** Cumulative books finished vs. the ideal straight line to the goal. */
function PaceChart({ byMonth, target }: { byMonth: number[]; target: number }) {
  const W = 300;
  const H = 120;
  const now = new Date().getMonth();
  const max = Math.max(
    target,
    byMonth.reduce((a, b) => a + b, 0),
    1,
  );
  const x = (i: number) => 8 + (i / 12) * (W - 16);
  const y = (v: number) => H - 14 - (v / max) * (H - 28);
  let acc = 0;
  const real = [`${x(0)},${y(0)}`];
  for (let i = 0; i <= now; i++) {
    acc += byMonth[i] ?? 0;
    real.push(`${x(i + 1)},${y(acc)}`);
  }
  const area = `M${real.join(" L")} L${x(now + 1)},${y(0)} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 h-auto w-full"
      role="img"
      aria-label="Gráfico de ritmo"
    >
      <defs>
        <linearGradient id="pace-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={x(0)} y1={y(0)} x2={x(12)} y2={y(0)} stroke="var(--border)" />
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(12)}
        y2={y(target)}
        stroke="var(--faint)"
        strokeDasharray="4 5"
        strokeWidth={1.5}
      />
      <path d={area} fill="url(#pace-fill)" />
      <polyline
        points={real.join(" ")}
        fill="none"
        stroke="var(--gold)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="pace-line"
      />
      <circle
        cx={x(now + 1)}
        cy={y(acc)}
        r={5}
        fill="var(--gold)"
        stroke="var(--card)"
        strokeWidth={2}
      />
      {[0, 3, 6, 9].map((i) => (
        <text key={i} x={x(i) + 2} y={H - 1} fontSize="9" fill="var(--faint)" fontWeight="600">
          {MONTHS_SHORT[i]}
        </text>
      ))}
      <text
        x={x(12)}
        y={y(target) - 6}
        fontSize="9.5"
        textAnchor="end"
        fill="var(--faint)"
        fontWeight="600"
      >
        meta {target}
      </text>
    </svg>
  );
}

function MiniRing({
  value,
  size,
  stroke,
  color,
  children,
}: {
  value: number;
  size: number;
  stroke: number;
  color: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, value) * c} ${c}`}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** The last 14 days as links of a chain: lit when you read. */
function StreakChain({ days }: { days: Record<string, number> }) {
  const links = useMemo(() => {
    const out: { key: string; on: boolean; today: boolean }[] = [];
    const d = new Date();
    for (let i = 13; i >= 0; i--) {
      const day = new Date(d);
      day.setDate(d.getDate() - i);
      const key = dayKey(day);
      out.push({ key, on: (days[key] ?? 0) > 0, today: i === 0 });
    }
    return out;
  }, [days]);
  return (
    <div className="mt-4 flex items-center" aria-label="Últimos 14 dias">
      {links.map((l, i) => (
        <div key={l.key} className="flex flex-1 items-center">
          {i > 0 && (
            <span
              className="h-[3px] flex-1"
              style={{ background: l.on && links[i - 1]!.on ? "#e0431a" : "var(--surface-2)" }}
            />
          )}
          <span
            title={l.key}
            className={`h-3 w-3 shrink-0 rounded-full ${l.today ? "ring-2 ring-offset-2 ring-offset-card" : ""}`}
            style={{
              background: l.on ? "#e0431a" : "var(--surface-2)",
              ["--tw-ring-color" as string]: "#e0431a",
            }}
          />
        </div>
      ))}
    </div>
  );
}
