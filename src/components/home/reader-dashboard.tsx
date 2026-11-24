import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Compass,
  Flame,
  Library,
  NotebookPen,
  Sparkles,
  Target,
  Trophy,
  UploadCloud,
} from "lucide-react";

import { EpubImport } from "@/components/epub-import";
import { LumiRecommendationCard } from "@/components/lumi-recommendation-card";
import { OnboardingCard } from "@/components/onboarding-card";
import { ProgressRing } from "@/components/progress-ring";
import { FauxCover, fauxBookFor } from "@/components/faux-cover";
import { Reveal } from "@/components/motion/reveal";
import { getLevelInfo } from "@/lib/achievements";
import { computeGoalProgress, currentYear, subscribeReadingGoal } from "@/lib/goals";
import { subscribeLibrary, type LibraryEntry, type LibraryStatus } from "@/lib/library";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { subscribeReadingProgress, type StoredReadingProgress } from "@/lib/reader-store";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";

const DISCOVER_SEARCH = { q: undefined, categoria: undefined };

function greeting(date = new Date()) {
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

export function ReaderDashboard({ user }: { user: User }) {
  const year = currentYear();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [progress, setProgress] = useState<StoredReadingProgress[]>([]);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [shelf, setShelf] = useState<LibraryStatus>("lendo");

  useEffect(() => {
    const unsubs = [
      subscribeUserProfile(user.uid, setProfile),
      subscribeLibrary(user.uid, setLibrary),
      subscribeReadingProgress(user.uid, setProgress),
      subscribeReadingGoal(user.uid, year, (g) => setGoalTarget(g?.books ?? null)),
    ];
    // Same safety net as the library page: never spin forever offline.
    const timer = setTimeout(() => setLibrary((l) => l ?? []), 10000);
    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(timer);
    };
  }, [user.uid, year]);

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

  const shelfBooks = useMemo(
    () => (library ?? []).filter((e) => e.status === shelf).slice(0, 12),
    [library, shelf],
  );

  const goal = computeGoalProgress(library ?? [], goalTarget ?? 0);
  const level = getLevelInfo(profile?.xp ?? 0);
  const streak = profile?.currentStreak ?? 0;
  const firstName =
    (profile?.displayName || user.displayName || "").trim().split(/\s+/)[0] || "leitor";

  const counts: Record<LibraryStatus, number> = {
    lendo: 0,
    "quero-ler": 0,
    concluido: 0,
    relendo: 0,
    abandonado: 0,
  };
  for (const e of library ?? []) counts[e.status] += 1;

  return (
    <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 md:px-8 md:pt-10">
      {/* Greeting */}
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight md:text-4xl">
            {greeting()}, <span className="text-gold">{firstName}</span>.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warm/30 bg-warm/10 px-3 py-1.5 text-sm font-semibold text-warm">
            <Flame className="h-4 w-4" /> {streak} {streak === 1 ? "dia" : "dias"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold">
            <Trophy className="h-4 w-4" /> Nível {level.level}
          </span>
        </div>
      </Reveal>

      {library?.length === 0 && <OnboardingCard />}

      {/* Hero row: continue reading + goal */}
      <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <Reveal delay={60}>
          {library === null ? (
            <div className="h-[15rem] animate-pulse rounded-3xl bg-secondary/60" />
          ) : current ? (
            <ContinueCard entry={current.entry} progress={current.progress} />
          ) : (
            <EmptyContinue />
          )}
        </Reveal>

        <Reveal delay={120} className="surface-card flex flex-col p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Meta {year}
            </p>
            <Link to="/metas" className="text-xs font-semibold text-gold hover:underline">
              {goalTarget ? "Ajustar" : "Definir meta"}
            </Link>
          </div>
          <div className="mt-4 flex flex-1 items-center gap-5">
            <ProgressRing
              value={goal.target ? goal.completed / goal.target : 0}
              size={104}
              stroke={10}
              label="Progresso da meta anual"
            >
              <div className="text-center">
                <p className="font-display text-2xl font-medium tabular-nums">
                  {goal.completed}
                  <span className="text-sm text-muted-foreground">/{goal.target || "—"}</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">livros</p>
              </div>
            </ProgressRing>
            <div className="min-w-0 text-sm">
              {goal.target ? (
                <>
                  <p className="font-medium">
                    {goal.remaining === 0
                      ? "Meta concluída! 🎉"
                      : `Faltam ${goal.remaining} ${goal.remaining === 1 ? "livro" : "livros"}`}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {goal.remaining === 0
                      ? "Que tal aumentar o desafio?"
                      : goal.onTrack
                        ? "Você está no ritmo certo."
                        : `Cerca de ${goal.perMonthNeeded} por mês para chegar lá.`}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Quantos livros neste ano?</p>
                  <p className="mt-1 text-muted-foreground">
                    Uma meta simples ajuda a criar o hábito.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Nível {level.level}</span>
              <span className="tabular-nums">
                {level.xpIntoLevel}/{level.xpForNextLevel} XP
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-warm transition-[width] duration-700"
                style={{ width: `${Math.round(level.progress * 100)}%` }}
              />
            </div>
          </div>
        </Reveal>
      </section>

      {/* Quick actions */}
      <section aria-label="Ações rápidas" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction
          to="/descobrir"
          icon={<Compass className="h-5 w-5" />}
          title="Descobrir"
          text="Clássicos grátis"
          delay={0}
        />
        <QuickAction
          to="/biblioteca"
          icon={<UploadCloud className="h-5 w-5" />}
          title="Importar"
          text="EPUB ou PDF"
          delay={60}
        />
        <Reveal delay={120}>
          <button
            type="button"
            onClick={() => openLumiPanel()}
            className="surface-card lift flex h-full w-full items-center gap-3 p-4 text-left"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">Lumi</span>
              <span className="block truncate text-xs text-muted-foreground">
                Pergunte qualquer coisa
              </span>
            </span>
          </button>
        </Reveal>
        <QuickAction
          to="/diario"
          icon={<NotebookPen className="h-5 w-5" />}
          title="Diário"
          text="Registrar leitura"
          delay={180}
        />
      </section>

      {/* Shelf */}
      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Sua estante</p>
            <h2 className="mt-1.5 font-display text-2xl font-medium md:text-3xl">Seus livros</h2>
          </div>
          <Link
            to="/biblioteca"
            className="inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline"
          >
            Ver biblioteca <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div
          role="tablist"
          aria-label="Estantes"
          className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0"
        >
          {(
            [
              ["lendo", "Lendo"],
              ["quero-ler", "Quero ler"],
              ["concluido", "Concluídos"],
              ["relendo", "Relendo"],
            ] as [LibraryStatus, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={shelf === id}
              onClick={() => setShelf(id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                shelf === id
                  ? "border-gold bg-gold text-primary-foreground shadow-md shadow-gold/20"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className={`ml-1.5 tabular-nums ${shelf === id ? "opacity-80" : "opacity-60"}`}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>
        {library === null ? (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        ) : shelfBooks.length ? (
          <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
            {shelfBooks.map((entry, i) => (
              <Reveal key={entry.id} delay={Math.min(i, 6) * 50}>
                <ShelfTile
                  entry={entry}
                  ratio={entry.readerId ? progressRatio(progressByReader.get(entry.readerId)) : 0}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
            <BookOpenCheck className="mx-auto h-6 w-6 text-gold" />
            <p className="mt-3 font-medium">Nada nesta estante ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Salve títulos no Descobrir ou importe um arquivo seu.
            </p>
            <Link to="/descobrir" search={DISCOVER_SEARCH} className="btn-primary mt-5 text-sm">
              Explorar livros <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>

      {/* Stats + Lumi + import */}
      <section className="mt-12 grid gap-5 lg:grid-cols-3">
        <Reveal className="surface-card p-6 lg:col-span-1">
          <p className="eyebrow">Seu ritmo</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat
              icon={<Library className="h-4 w-4" />}
              label="Na biblioteca"
              value={library?.length ?? 0}
            />
            <Stat
              icon={<Trophy className="h-4 w-4" />}
              label="Concluídos"
              value={Math.max(profile?.booksCompleted ?? 0, counts.concluido)}
            />
            <Stat
              icon={<BookOpen className="h-4 w-4" />}
              label="Capítulos"
              value={profile?.chaptersRead ?? 0}
            />
            <Stat
              icon={<Flame className="h-4 w-4" />}
              label="Maior sequência"
              value={profile?.longestStreak ?? streak}
            />
          </div>
        </Reveal>
        <Reveal delay={80} className="lg:col-span-1">
          <LumiRecommendationCard user={user} libraryEntries={library ?? []} />
        </Reveal>
        <Reveal delay={160} className="lg:col-span-1">
          <EpubImport className="h-full" />
        </Reveal>
      </section>
    </div>
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
  return (
    <Link
      to="/reader/$bookId"
      params={{ bookId: entry.readerId! }}
      className="group relative flex h-full overflow-hidden rounded-3xl bg-night p-6 text-night-foreground shadow-[0_30px_60px_-40px_rgb(10_30_70/0.7)] md:p-7"
    >
      {entry.cover && (
        <img
          src={entry.cover}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-2xl"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#1769d8]/40 blur-3xl"
      />
      <div className="relative flex w-full gap-5 md:gap-7">
        {entry.cover ? (
          <img
            src={entry.cover}
            alt={`Capa de ${entry.title}`}
            className="book-shadow aspect-[2/3] w-24 shrink-0 rounded-md object-cover transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-2deg] sm:w-32"
          />
        ) : (
          <div className="book-shadow grid aspect-[2/3] w-24 shrink-0 place-items-center rounded-md bg-white/10 p-3 text-center font-display text-sm sm:w-32">
            {entry.title}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7fb6ff]">
            Continue lendo
          </p>
          <p className="mt-2 line-clamp-2 font-display text-2xl font-medium leading-tight md:text-3xl">
            {entry.title}
          </p>
          <p className="mt-1 truncate text-sm text-white/65">{entry.author}</p>
          <div className="mt-auto pt-5">
            <div className="flex justify-between text-xs text-white/65">
              <span>
                {progress
                  ? `Capítulo ${(progress.chapterIndex ?? 0) + 1}${progress.chapterCount ? ` de ${progress.chapterCount}` : ""}`
                  : "Comece quando quiser"}
              </span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#5aa7ff] transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0a3f9e] transition group-hover:gap-3">
              {percent > 0 ? "Retomar leitura" : "Começar"} <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyContinue() {
  return (
    <div className="flex h-full flex-col justify-center rounded-3xl border border-dashed border-border bg-card/40 p-7">
      <BookOpenCheck className="h-7 w-7 text-gold" />
      <p className="mt-3 font-display text-2xl font-medium">Nenhuma leitura em andamento.</p>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Escolha um clássico gratuito ou importe um EPUB/PDF seu — ele aparece aqui com o seu
        progresso.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/descobrir" search={DISCOVER_SEARCH} className="btn-primary text-sm">
          Descobrir livros <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/biblioteca" className="btn-ghost text-sm">
          <UploadCloud className="h-4 w-4" /> Importar arquivo
        </Link>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  title,
  text,
  delay,
}: {
  to: "/descobrir" | "/biblioteca" | "/diario";
  icon: React.ReactNode;
  title: string;
  text: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <Link
        to={to}
        search={(to === "/descobrir" ? DISCOVER_SEARCH : undefined) as never}
        className="surface-card lift flex h-full items-center gap-3 p-4"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{text}</span>
        </span>
      </Link>
    </Reveal>
  );
}

function ShelfTile({ entry, ratio }: { entry: LibraryEntry; ratio: number }) {
  const inner = (
    <>
      <div className="relative">
        {entry.cover ? (
          <img
            src={entry.cover}
            alt={`Capa de ${entry.title}`}
            loading="lazy"
            className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-300 group-hover:-translate-y-1.5"
          />
        ) : (
          <FauxCover
            book={fauxBookFor(entry.title, entry.author ?? "")}
            className="transition-transform duration-300 group-hover:-translate-y-1.5"
          />
        )}
        {ratio > 0 && (
          <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/30 backdrop-blur">
            <div className="h-full rounded-full bg-white" style={{ width: `${ratio * 100}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2 truncate font-display text-sm font-medium">{entry.title}</p>
      <p className="truncate text-xs text-muted-foreground">{entry.author}</p>
    </>
  );
  return entry.readerId ? (
    <Link to="/reader/$bookId" params={{ bookId: entry.readerId }} className="group block min-w-0">
      {inner}
    </Link>
  ) : (
    <Link to="/biblioteca" className="group block min-w-0">
      {inner}
    </Link>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-gold">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-medium tabular-nums">{value}</p>
    </div>
  );
}
