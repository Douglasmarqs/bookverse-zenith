import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Flame,
  Plus,
  Search,
  Sparkles,
  Target,
  UploadCloud,
  Wand2,
} from "lucide-react";

import { EpubImport } from "@/components/epub-import";
import { FauxCover } from "@/components/faux-cover";
import { LumiMascot } from "@/components/lumi-mascot";
import { LumiRecommendationCard } from "@/components/lumi-recommendation-card";
import { Magnetic, Tilt } from "@/components/motion/interactive";
import { WEEKLY_MISSIONS, getLevelInfo } from "@/lib/achievements";
import { openCommandPalette } from "@/lib/command-palette-store";
import { fauxBookFor } from "@/lib/faux-books";
import { computeGoalProgress, currentYear, subscribeReadingGoal } from "@/lib/goals";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { DISCOVER_SEARCH } from "@/lib/nav";
import { getLocalOnboarding, loadOnboarding } from "@/lib/onboarding";
import { subscribeReadingProgress, type StoredReadingProgress } from "@/lib/reader-store";
import { useRitual } from "@/lib/ritual";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";

const EASE = [0.16, 1, 0.3, 1] as const;

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function progressRatio(progress?: StoredReadingProgress): number {
  if (!progress) return 0;
  const ratio =
    progress.overallRatio ??
    ((progress.chapterIndex ?? 0) + (progress.scrollRatio ?? 0)) /
      Math.max(1, progress.chapterCount ?? 1);
  return Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function ReaderDashboard({ user }: { user: User }) {
  const reduce = useReducedMotion();
  const now = useNow();
  const year = currentYear();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [progress, setProgress] = useState<StoredReadingProgress[]>([]);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(() =>
    getLocalOnboarding(user.uid) ? true : null,
  );
  const ritual = useRitual(user.uid);

  useEffect(() => {
    const unsubs = [
      subscribeUserProfile(user.uid, setProfile),
      subscribeLibrary(user.uid, setLibrary),
      subscribeReadingProgress(user.uid, setProgress),
      subscribeReadingGoal(user.uid, year, (g) => setGoalTarget(g?.books ?? null)),
    ];
    const timer = setTimeout(() => setLibrary((l) => l ?? []), 10000);
    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(timer);
    };
  }, [user.uid, year]);

  useEffect(() => {
    if (onboarded) return;
    let alive = true;
    void loadOnboarding(user.uid).then((p) => alive && setOnboarded(!!p));
    return () => {
      alive = false;
    };
  }, [user.uid, onboarded]);

  const progressByReader = useMemo(
    () => new Map(progress.map((item) => [item.bookId, item])),
    [progress],
  );

  const reading = useMemo(
    () =>
      (library ?? [])
        .filter((e) => (e.status === "lendo" || e.status === "relendo") && e.readerId)
        .map((entry) => ({ entry, progress: progressByReader.get(entry.readerId!) }))
        .sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0)),
    [library, progressByReader],
  );
  const current = reading[0];

  const shelf = useMemo(() => {
    const order = { lendo: 0, relendo: 1, "quero-ler": 2, concluido: 3, abandonado: 4 } as const;
    return [...(library ?? [])]
      .filter((e) => e.status !== "abandonado")
      .sort((a, b) => order[a.status] - order[b.status])
      .slice(0, 16);
  }, [library]);

  const goal = computeGoalProgress(library ?? [], goalTarget ?? 0);
  const level = getLevelInfo(profile?.xp ?? 0);
  const streak = profile?.currentStreak ?? 0;
  const firstName =
    (profile?.displayName || user.displayName || "").trim().split(/\s+/)[0] || "leitor";
  const mission = profile
    ? WEEKLY_MISSIONS.map((m) => ({ m, value: m.metric(profile) })).find(
        ({ m, value }) => value < m.threshold,
      )
    : undefined;

  const ritualRatio = Math.min(1, ritual.todayMinutes / Math.max(1, ritual.goal));
  const ritualLeft = Math.max(0, Math.ceil(ritual.goal - ritual.todayMinutes));

  const rise = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <div className="relative mx-auto max-w-[84rem] px-5 pb-16 pt-6 md:px-10 md:pt-10">
      <div
        aria-hidden
        className="lamp-glow lamp-breathe pointer-events-none absolute -right-40 -top-72 h-[46rem] w-[46rem]"
      />

      {/* Header */}
      <motion.header
        {...rise()}
        className="relative flex flex-wrap items-end justify-between gap-5"
      >
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h1 className="mt-1 font-display text-5xl leading-none md:text-6xl">
            {greeting(now)}, <span className="italic text-gold">{firstName}.</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCommandPalette}
            className="press hidden h-11 w-80 items-center gap-2.5 whitespace-nowrap rounded-full border border-border bg-card/50 px-4 text-sm text-muted-foreground backdrop-blur transition hover:border-gold/40 md:flex"
          >
            <Search className="h-4 w-4" /> Buscar livros, páginas, ações
            <kbd className="ml-auto rounded-md border border-border px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
          <span
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-warm/40 bg-warm/10 px-4 text-sm font-semibold text-warm"
            title="Dias seguidos com leitura"
          >
            <Flame className="h-4 w-4" /> {streak} {streak === 1 ? "noite" : "noites"}
          </span>
        </div>
      </motion.header>

      {onboarded === false && (
        <motion.div {...rise(0.05)}>
          <Link
            to="/bem-vindo"
            search={{}}
            className="group relative mt-6 flex items-center gap-4 overflow-hidden rounded-3xl border border-gold/30 bg-gold/10 p-4 pr-5 transition hover:border-gold/60"
          >
            <LumiMascot size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-tight">Vamos arrumar sua estante?</p>
              <p className="text-sm text-muted-foreground">
                Em um minuto: seus gêneros, seu ritual diário e o primeiro livro.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-gold transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      )}

      {/* Continue + ritual */}
      <section className="relative mt-7 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,1fr)]">
        <motion.div {...rise(0.08)} className="min-w-0">
          {library === null ? (
            <div className="h-[19rem] animate-pulse rounded-[1.75rem] bg-card" />
          ) : current ? (
            <ContinueCard entry={current.entry} progress={current.progress} />
          ) : (
            <EmptyContinue />
          )}
        </motion.div>

        <motion.div
          {...rise(0.14)}
          className="flex flex-col rounded-[1.75rem] border border-border bg-card/70 p-6 backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">Ritual de hoje</span>
            <span className="text-xs text-muted-foreground">meta {ritual.goal} min</span>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <RitualRing
              ratio={ritualRatio}
              minutes={Math.floor(ritual.todayMinutes)}
              goal={ritual.goal}
            />
            <div className="min-w-0 text-sm">
              <p className="leading-snug text-muted-foreground">
                {ritualLeft === 0 ? (
                  <>
                    Ritual cumprido.{" "}
                    <span className="font-semibold text-foreground">Vela acesa!</span>
                  </>
                ) : (
                  <>
                    Faltam <span className="font-semibold text-foreground">{ritualLeft} min</span>{" "}
                    para acender a vela de hoje.
                  </>
                )}
              </p>
              <div className="mt-3 flex gap-1.5">
                {ritual.week.map((d) => (
                  <span
                    key={d.key}
                    title={`${d.key}: ${Math.round(d.minutes)} min`}
                    className={`grid h-8 w-6 place-items-center rounded-md text-[10px] font-semibold ${
                      d.met
                        ? "bg-gold/20 text-gold"
                        : d.today
                          ? "border border-dashed border-gold/60 text-gold"
                          : "border border-border text-muted-foreground"
                    }`}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="foil my-5" />
          {mission ? (
            <div className="flex items-center gap-3 text-sm">
              <Target className="h-4 w-4 shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground">Missão · </span>
                {mission.m.title}
              </span>
              <span className="num text-xl text-gold">
                {Math.min(mission.value, mission.m.threshold)}/{mission.m.threshold}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Missões da semana completas. Que fôlego!
            </p>
          )}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Nível {level.level}</span>
              <span className="tabular-nums">
                {level.xpIntoLevel}/{level.xpForNextLevel} XP
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--oxide),var(--gold-soft))]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(level.progress * 100)}%` }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Shelf */}
      <motion.section {...rise(0.2)} className="relative mt-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-4xl">
            Sua estante{" "}
            <span className="text-lg text-muted-foreground">{library?.length ?? 0} livros</span>
          </h2>
          <Link
            to="/biblioteca"
            className="group inline-flex items-center gap-1 text-sm font-semibold text-gold"
          >
            Abrir estante{" "}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <div className="no-scrollbar flex h-52 items-end gap-[5px] overflow-x-auto px-2 pt-6">
              {library === null
                ? Array.from({ length: 9 }, (_, i) => (
                    <div
                      key={i}
                      className="h-[80%] w-10 shrink-0 animate-pulse rounded-t bg-card"
                    />
                  ))
                : shelf.map((e) => (
                    <ShelfSpine
                      key={e.id}
                      entry={e}
                      ratio={e.readerId ? progressRatio(progressByReader.get(e.readerId)) : 0}
                    />
                  ))}
              <Link
                to="/descobrir"
                search={DISCOVER_SEARCH}
                aria-label="Adicionar livros"
                className="press grid h-[78%] w-12 shrink-0 place-items-center rounded-t-[3px] border border-dashed border-border text-muted-foreground transition hover:border-gold/50 hover:text-gold"
              >
                <Plus className="h-5 w-5" />
              </Link>
            </div>
            <div className="shelfboard" />
          </div>
          <div className="self-end">
            <LumiRecommendationCard user={user} libraryEntries={library ?? []} />
          </div>
        </div>
      </motion.section>

      {/* Goal + import */}
      <section className="relative mt-12 grid gap-5 md:grid-cols-2">
        <motion.div
          {...rise(0.25)}
          className="rounded-[1.75rem] border border-border bg-card/70 p-6"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">Meta {year}</span>
            <Link to="/metas" className="text-xs font-semibold text-gold hover:underline">
              {goalTarget ? "Ajustar" : "Definir meta"}
            </Link>
          </div>
          <p className="mt-3 font-display text-4xl">
            <span className="num text-gold">{goal.completed}</span>
            <span className="text-muted-foreground"> de {goal.target || "—"} livros</span>
          </p>
          <div className="mt-4 flex h-20 items-end gap-1 overflow-hidden">
            {Array.from({ length: Math.min(Math.max(goal.target, 6), 36) }, (_, i) => {
              const filled = i < goal.completed;
              const fb = fauxBookFor(String(i * 7 + 3));
              return filled ? (
                <motion.span
                  key={i}
                  initial={{ y: -40, opacity: 0, rotate: 180 }}
                  animate={{ y: 0, opacity: 1, rotate: 180 }}
                  transition={{
                    delay: 0.4 + i * 0.06,
                    type: "spring",
                    stiffness: 240,
                    damping: 18,
                  }}
                  className="spine min-w-[3px] max-w-5 flex-1"
                  style={
                    { "--s-bg": fb.bg, height: `${78 + ((i * 13) % 20)}%` } as React.CSSProperties
                  }
                />
              ) : (
                <span
                  key={i}
                  className="h-[78%] min-w-[3px] max-w-5 flex-1 rounded-t-[2px] border border-dashed border-border"
                />
              );
            })}
          </div>
          <div className="shelfboard h-2" />
          <p className="mt-3 text-sm text-muted-foreground">
            {goal.target
              ? goal.remaining === 0
                ? "Meta concluída. Que tal aumentar o desafio?"
                : goal.onTrack
                  ? "Você está no ritmo certo."
                  : `Cerca de ${goal.perMonthNeeded} por mês para completar a estante.`
              : "Defina quantos livros quer ler neste ano."}
          </p>
        </motion.div>
        <motion.div {...rise(0.3)}>
          <EpubImport className="h-full" />
        </motion.div>
      </section>
    </div>
  );
}

function RitualRing({ ratio, minutes, goal }: { ratio: number; minutes: number; goal: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative grid h-28 w-28 shrink-0 place-items-center"
      role="img"
      aria-label={`${minutes} de ${goal} minutos hoje`}
    >
      <svg viewBox="0 0 110 110" className="absolute inset-0 -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" strokeWidth="9" className="stroke-secondary" />
        <motion.circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
          style={{ stroke: "var(--gold)" }}
        />
      </svg>
      <div className="text-center">
        <p className="num text-4xl leading-none">{minutes}</p>
        <p className="text-[10px] text-muted-foreground">de {goal} min</p>
      </div>
    </div>
  );
}

function ShelfSpine({ entry, ratio }: { entry: LibraryEntry; ratio: number }) {
  const fb = fauxBookFor(entry.title, entry.author);
  const reading = entry.status === "lendo" || entry.status === "relendo";
  const h = 72 + ((entry.title.length * 7) % 26);
  const w = 34 + ((entry.title.length * 5) % 18);
  const content = (
    <motion.span
      initial={{ rotate: 180 }}
      animate={{ rotate: 180 }}
      whileHover={{ y: -14 }}
      transition={{ type: "spring", stiffness: 320, damping: 20 }}
      className="spine relative h-full w-full text-[15px]"
      style={
        {
          "--s-bg": fb.bg,
          "--s-fg": fb.fg,
          boxShadow: reading
            ? "0 0 0 1px var(--gold), 0 0 26px color-mix(in oklab, var(--gold) 30%, transparent)"
            : undefined,
        } as React.CSSProperties
      }
    >
      <span className="truncate">{entry.title}</span>
      {ratio > 0 && (
        <span
          aria-hidden
          className="absolute bottom-0 right-0 top-0 w-[3px] bg-gold"
          style={{ clipPath: `inset(${(1 - ratio) * 100}% 0 0 0)` }}
        />
      )}
    </motion.span>
  );
  const cls =
    "group relative block shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-gold";
  const style = { height: `${h}%`, width: w };
  const label = `${entry.title}${ratio > 0 ? ` — ${Math.round(ratio * 100)}% lido` : ""}`;
  return entry.readerId ? (
    <Link
      to="/reader/$bookId"
      params={{ bookId: entry.readerId }}
      className={cls}
      style={style}
      aria-label={label}
      title={label}
    >
      {content}
    </Link>
  ) : (
    <Link to="/biblioteca" className={cls} style={style} aria-label={label} title={label}>
      {content}
    </Link>
  );
}

function ContinueCard({
  entry,
  progress,
}: {
  entry: LibraryEntry;
  progress?: StoredReadingProgress;
}) {
  const ratio = progressRatio(progress);
  const percent = Math.round(ratio * 100);
  const chapter = progress ? (progress.chapterIndex ?? 0) + 1 : null;
  return (
    <div className="grain relative h-full overflow-hidden rounded-[1.75rem] border border-gold/25 bg-[linear-gradient(120deg,color-mix(in_oklab,var(--gold)_12%,var(--night)),var(--night)_70%)] p-6 text-night-foreground shadow-[0_40px_80px_-50px_rgb(0_0_0/0.9)] md:p-7">
      <div aria-hidden className="lamp-glow absolute -left-24 -top-24 h-80 w-80" />
      <div className="relative grid h-full gap-6 sm:grid-cols-[9.5rem_1fr] md:gap-8">
        <Link
          to="/reader/$bookId"
          params={{ bookId: entry.readerId! }}
          className="mx-auto block w-32 sm:w-full"
          aria-label={`Abrir ${entry.title}`}
        >
          <Tilt max={12} className="rounded-md">
            {entry.cover ? (
              <img
                src={entry.cover}
                alt={`Capa de ${entry.title}`}
                className="aspect-[2/3] w-full rounded-[4px_8px_8px_4px] object-cover shadow-[0_30px_50px_-20px_rgb(0_0_0/0.9)]"
              />
            ) : (
              <FauxCover book={fauxBookFor(entry.title, entry.author ?? "")} />
            )}
          </Tilt>
        </Link>
        <div className="flex min-w-0 flex-col">
          <span className="eyebrow">Continue de onde parou</span>
          <p className="mt-2 line-clamp-2 font-display text-4xl leading-[1] md:text-5xl">
            {entry.title}
          </p>
          <p className="mt-1 truncate text-sm opacity-65">
            {entry.author}
            {chapter
              ? ` · Capítulo ${chapter}${progress?.chapterCount ? ` de ${progress.chapterCount}` : ""}`
              : ""}
          </p>
          <div className="mt-auto pt-6">
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--oxide),var(--gold-soft))]"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
                />
              </div>
              <span className="num text-2xl text-gold">{percent}%</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Magnetic>
                <Link
                  to="/reader/$bookId"
                  params={{ bookId: entry.readerId! }}
                  className="btn-primary"
                >
                  <BookOpen className="h-4 w-4" /> {percent > 0 ? "Retomar leitura" : "Começar"}
                </Link>
              </Magnetic>
              {chapter && chapter > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    openLumiPanel({
                      bookTitle: entry.title,
                      bookAuthor: entry.author,
                      positionLabel: `Capítulo ${chapter}`,
                      topic: "summary",
                      initialPrompt: `Estou no capítulo ${chapter} de “${entry.title}”. Me lembre, sem revelar nada depois desse ponto, o que aconteceu até aqui e quem são os personagens principais.`,
                    })
                  }
                  className="press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:border-gold/50"
                >
                  <Wand2 className="h-4 w-4 text-gold" /> Onde eu parei?
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyContinue() {
  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-border bg-card/50 p-7">
      <LumiMascot size={64} />
      <p className="mt-4 font-display text-4xl leading-none">Nenhuma leitura em andamento.</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Puxe um clássico do acervo ou traga um EPUB/PDF seu. Ele aparece aqui com o seu progresso.
      </p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link to="/descobrir" search={DISCOVER_SEARCH} className="btn-primary">
          <Compass className="h-4 w-4" /> Explorar o acervo
        </Link>
        <Link to="/biblioteca" className="btn-ghost">
          <UploadCloud className="h-4 w-4" /> Importar arquivo
        </Link>
        <button type="button" onClick={() => openLumiPanel()} className="btn-ghost">
          <Sparkles className="h-4 w-4" /> Pedir uma indicação
        </button>
      </div>
    </div>
  );
}
