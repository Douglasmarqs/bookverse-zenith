import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileUp,
  Flame,
  Headphones,
  Moon,
  MoonStar,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Sunrise,
} from "lucide-react";

import { BookArt } from "@/components/book-art";
import { LangTag } from "@/components/lang-tag";
import { Lumi } from "@/components/brand/lumi";
import { AccountMenu } from "@/components/shell/account-menu";
import { openCommandPalette } from "@/lib/command-palette-store";
import { picksFor, type LumiPick } from "@/lib/editorial";
import { useSway } from "@/components/motion/use-sway";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { bookPalette } from "@/lib/faux-books";
import { computeGoalProgress, currentYear, subscribeReadingGoal } from "@/lib/goals";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { useDeviceBooks } from "@/lib/device-books";
import { DISCOVER_SEARCH, getLastBookInfo, OFFLINE_UID } from "@/lib/nav";
import { getLocalOnboarding, loadOnboarding } from "@/lib/onboarding";
import { gutenbergReaderId } from "@/lib/public-domain";
import {
  loadProgressLocal,
  subscribeReadingProgress,
  type StoredReadingProgress,
} from "@/lib/reader-store";
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

export function formatMinutes(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${String(r).padStart(2, "0")}min` : `${h}h`;
}

function Ring({ ratio, size = 52, stroke = 6 }: { ratio: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--gold)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - ratio) }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
      />
    </svg>
  );
}

export function HomeScreen({ user }: { user: User | null }) {
  const reduce = useReducedMotion();
  const year = currentYear();
  const guest = !user || user.isAnonymous;
  // Guests keep ritual and preferences under the same id the reader uses.
  const uid = user?.uid ?? OFFLINE_UID;
  const device = useDeviceBooks();
  const [now, setNow] = useState(() => new Date());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [progress, setProgress] = useState<StoredReadingProgress[]>([]);
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(() =>
    getLocalOnboarding(uid) ? true : null,
  );
  const [tastes, setTastes] = useState<string[]>(() => getLocalOnboarding(uid)?.genres ?? []);
  const [shuffle, setShuffle] = useState(0);
  const ritual = useRitual(uid);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (guest) return;
    const unsubs = [
      subscribeUserProfile(uid, setProfile),
      subscribeLibrary(uid, setLibrary),
      subscribeReadingProgress(uid, setProgress),
      subscribeReadingGoal(uid, year, (g) => setGoalTarget(g?.books ?? null)),
    ];
    const timer = setTimeout(() => setLibrary((l) => l ?? []), 10000);
    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(timer);
    };
  }, [guest, uid, year]);

  // Guests: the books saved on this device, with their local progress.
  useEffect(() => {
    if (!guest) return;
    const prog: StoredReadingProgress[] = [];
    const entries: LibraryEntry[] = device.map((d) => {
      const p = loadProgressLocal(d.id);
      if (p) prog.push({ ...p, bookId: d.id });
      return {
        id: d.id,
        title: d.title,
        author: d.author,
        cover: null,
        readerId: d.id,
        status: p ? "lendo" : "quero-ler",
      };
    });
    setProgress(prog);
    setLibrary(entries);
  }, [guest, device]);

  useEffect(() => {
    if (onboarded) return;
    if (guest) {
      const local = getLocalOnboarding(uid);
      setOnboarded(!!local);
      setTastes(local?.genres ?? []);
      return;
    }
    let alive = true;
    void loadOnboarding(uid).then((p) => {
      if (!alive) return;
      setOnboarded(!!p);
      setTastes(p?.genres ?? []);
    });
    return () => {
      alive = false;
    };
  }, [guest, uid, onboarded]);

  const progressByReader = useMemo(() => new Map(progress.map((p) => [p.bookId, p])), [progress]);
  const reading = useMemo(
    () =>
      (library ?? [])
        .filter((e) => (e.status === "lendo" || e.status === "relendo") && e.readerId)
        .map((entry) => ({ entry, progress: progressByReader.get(entry.readerId!) }))
        .sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0)),
    [library, progressByReader],
  );
  const current = reading[0];
  const shelf = useMemo(
    () =>
      (library ?? [])
        .filter((e) => e.status !== "abandonado" && e.id !== current?.entry.id)
        .slice(0, 12),
    [library, current],
  );
  const picks = useMemo(
    () =>
      picksFor({
        genres: tastes,
        exclude: (library ?? []).map((e) => e.title),
        count: 13,
        shuffle,
      }),
    [tastes, library, shuffle],
  );
  const todayPick = picks[0];

  const goal = computeGoalProgress(library ?? [], goalTarget ?? 0);
  const streak = profile?.currentStreak ?? 0;
  const firstName =
    (profile?.displayName || user?.displayName || "").trim().split(/\s+/)[0] || "leitor";
  const ritualRatio = Math.min(1, ritual.todayMinutes / Math.max(1, ritual.goal));
  const ritualLeft = Math.max(0, Math.ceil(ritual.goal - ritual.todayMinutes));
  const hour = now.getHours();
  const TimeIcon = hour < 5 ? MoonStar : hour < 12 ? Sunrise : hour < 18 ? Sun : Moon;
  const rawDate = now
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .replace("-feira", "");
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const subtitle = current
    ? ritualLeft > 0
      ? `Faltam ${ritualLeft} min para sua meta de hoje — que tal seguir com “${current.entry.title}”?`
      : `Meta de hoje cumprida. Mais um capítulo de “${current.entry.title}”?`
    : ritualLeft > 0
      ? `${ritualLeft} minutos de leitura fecham o seu dia. Escolha um livro e comece.`
      : "Meta de hoje cumprida. Que tal descobrir o próximo livro?";

  const rise = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0.55, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: EASE, delay },
        };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-[calc(env(safe-area-inset-top)+0.875rem)] sm:px-6 lg:px-10 lg:pt-10">
      {/* Header */}
      <motion.header {...rise()} className="px-1">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-card py-1.5 pl-2.5 pr-3 text-[12.5px] font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
            <TimeIcon className="h-[15px] w-[15px] shrink-0 text-gold" strokeWidth={2.2} />
            <span className="truncate">{dateLabel}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Buscar"
              className="press grid h-[42px] w-[42px] place-items-center rounded-full bg-card shadow-[inset_0_0_0_1px_var(--border)]"
            >
              <Search className="h-[19px] w-[19px]" />
            </button>
            <AccountMenu />
          </div>
          <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
            <Link
              to="/perfil"
              title="Sua sequência de leitura"
              className="inline-flex h-[42px] items-center gap-2 rounded-full bg-card px-4 text-sm font-bold shadow-[inset_0_0_0_1px_var(--border)] transition hover:bg-surface-2"
            >
              <Flame className="h-[18px] w-[18px] text-gold" /> {streak}{" "}
              {streak === 1 ? "dia seguido" : "dias seguidos"}
            </Link>
            <AccountMenu />
          </div>
        </div>

        <h1 className="mt-4 lg:mt-6">
          <span
            className={
              guest
                ? "block font-display text-[clamp(34px,10vw,44px)] leading-[1.02] tracking-[-0.03em] lg:text-[52px]"
                : "block text-[clamp(19px,5.4vw,23px)] font-medium leading-tight tracking-[-0.01em] text-muted-foreground lg:text-[26px]"
            }
          >
            {greeting(now)}
            {guest ? "" : ","}
          </span>
          {!guest && (
            <span className="mt-0.5 block truncate font-display text-[clamp(34px,10vw,44px)] leading-[1.06] tracking-[-0.03em] lg:text-[52px]">
              {firstName}
            </span>
          )}
        </h1>
        <p className="mt-2 line-clamp-2 max-w-[34rem] text-[14.5px] leading-snug text-muted-foreground">
          {subtitle}
        </p>
      </motion.header>

      {onboarded === false && (
        <motion.div {...rise(0.04)}>
          <Link
            to="/bem-vindo"
            className="press mt-5 flex items-center gap-4 rounded-[26px] bg-accent-soft p-4 pr-5"
          >
            <Lumi pose="hello" size={64} shadow={false} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-tight">Vamos montar sua estante?</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Seus gostos e seu ritmo em 20 segundos.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-gold" />
          </Link>
        </motion.div>
      )}

      <div className="mt-5 grid gap-3 lg:mt-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] lg:gap-5">
        {/* Continue */}
        <motion.div {...rise(0.06)} className="min-w-0">
          {library === null ? (
            <div className="h-[19rem] animate-pulse rounded-[30px] bg-card" />
          ) : current ? (
            <ContinueCard entry={current.entry} progress={current.progress} />
          ) : (
            <StartCard />
          )}
        </motion.div>

        {/* Today + streak — two cards on phones, one on desktop */}
        <motion.div {...rise(0.12)} className="grid grid-cols-2 gap-3 lg:hidden">
          <div className="surface-card flex items-center gap-3 p-3.5">
            <div className="relative shrink-0">
              <Ring ratio={ritualRatio} />
              <span className="absolute inset-0 grid place-items-center font-display text-sm">
                {Math.round(ritualRatio * 100)}%
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Hoje</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {Math.floor(ritual.todayMinutes)} de {ritual.goal} min
              </p>
            </div>
          </div>
          <div className="surface-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">
                {streak} {streak === 1 ? "dia" : "dias"}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-gold">
                <Flame className="h-[15px] w-[15px]" /> seguidos
              </span>
            </div>
            <WeekRow week={ritual.week} />
          </div>
        </motion.div>
        <motion.div {...rise(0.12)} className="surface-card hidden flex-col p-6 lg:flex">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold">Hoje</p>
            <p className="text-[13px] text-muted-foreground">meta {ritual.goal} min</p>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <div className="relative shrink-0">
              <Ring ratio={ritualRatio} size={96} stroke={10} />
              <span className="absolute inset-0 grid place-items-center font-display text-[22px]">
                {Math.floor(ritual.todayMinutes)}&apos;
              </span>
            </div>
            <div>
              <p className="font-display text-[28px] leading-none">
                {ritualLeft > 0 ? `${ritualLeft} min` : "Meta batida"}
              </p>
              <p className="mt-1.5 text-[13.5px] text-muted-foreground">
                {ritualLeft > 0 ? "para fechar o dia" : "volte amanhã para manter a sequência"}
              </p>
            </div>
          </div>
          <div className="flex-1" />
          <WeekRow week={ritual.week} large />
        </motion.div>
      </div>

      {todayPick && <LumiTodayCard pick={todayPick} delay={0.16} />}

      <Rail
        title="Feito para você"
        to="/descobrir"
        delay={0.18}
        contentKey={shuffle || undefined}
        action={
          <button
            type="button"
            onClick={() => setShuffle((n) => n + 1)}
            aria-label="Outras sugestões"
            className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-semibold"
          >
            <motion.span
              key={shuffle}
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="grid"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
            </motion.span>
            Outras
          </button>
        }
      >
        {picks.slice(1).map((p) => (
          <BookTile
            key={p.gutenbergId}
            title={p.title}
            author={p.author}
            meta={formatMinutes(p.minutes)}
            lang={p.lang}
            readerId={gutenbergReaderId(p.gutenbergId)}
          />
        ))}
      </Rail>

      {shelf.length > 0 && (
        <Rail title="Na sua biblioteca" to="/biblioteca" delay={0.22}>
          {shelf.map((e) => (
            <BookTile
              key={e.id}
              title={e.title}
              author={e.author}
              cover={e.cover}
              meta={
                e.status === "concluido" ? "Lido" : e.status === "quero-ler" ? "Quero ler" : "Lendo"
              }
              readerId={e.readerId ?? undefined}
            />
          ))}
        </Rail>
      )}
    </div>
  );
}

function WeekRow({
  week,
  large = false,
}: {
  week: { key: string; label: string; minutes: number; met: boolean; today: boolean }[];
  large?: boolean;
}) {
  return (
    <div className={`flex ${large ? "mt-5 gap-1.5" : "mt-2.5 gap-[5px]"}`}>
      {week.map((d) => (
        <span
          key={d.key}
          title={`${Math.round(d.minutes)} min`}
          className={`grid flex-1 place-items-center font-bold ${large ? "h-[34px] rounded-[10px] text-xs" : "h-[26px] rounded-lg text-[10.5px]"} ${
            d.met
              ? "bg-gold text-white"
              : d.today
                ? "bg-accent-soft text-gold"
                : "bg-secondary text-faint"
          }`}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

function Rail({
  title,
  to,
  delay,
  action,
  contentKey,
  children,
}: {
  contentKey?: string | number;
  title: string;
  to: "/biblioteca" | "/descobrir";
  delay: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [contentKey, children]);

  useSway(
    () => track.current,
    () => track.current,
    "x",
    [contentKey],
  );

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el)
      el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };
  // Soft fade on the side(s) that still have books — a hint there's more.
  const mask =
    edges.left && edges.right
      ? "linear-gradient(90deg,transparent,#000 48px,#000 calc(100% - 48px),transparent)"
      : edges.right
        ? "linear-gradient(90deg,#000 calc(100% - 64px),transparent)"
        : edges.left
          ? "linear-gradient(90deg,transparent,#000 48px)"
          : undefined;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0.55, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className="mt-8 lg:mt-10"
      aria-label={title}
    >
      <div className="mb-3.5 flex items-center justify-between gap-3 px-1">
        <h2 className="min-w-0 truncate text-[21px] lg:text-[26px]">{title}</h2>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {action}
          <Link
            to={to}
            search={to === "/descobrir" ? DISCOVER_SEARCH : undefined}
            className="rounded-full px-1 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver tudo
          </Link>
          <div className="hidden items-center gap-1.5 md:flex">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => page(dir)}
                disabled={dir < 0 ? !edges.left : !edges.right}
                aria-label={dir < 0 ? `Voltar em ${title}` : `Mais em ${title}`}
                className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-[inset_0_0_0_1px_var(--border)] transition hover:bg-surface-2 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-card"
              >
                {dir < 0 ? (
                  <ChevronLeft className="h-[18px] w-[18px]" />
                ) : (
                  <ChevronRight className="h-[18px] w-[18px]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <motion.div
        key={contentKey}
        ref={track}
        initial={contentKey ? { opacity: 0.3, x: 18 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        className="rail-flow no-scrollbar -mx-4 flex snap-x scroll-pl-4 gap-3.5 overflow-x-auto overscroll-x-contain px-4 pb-2 pt-3 sm:-mx-6 sm:scroll-pl-6 sm:px-6 md:snap-mandatory lg:mx-0 lg:scroll-pl-0 lg:gap-5 lg:px-0"
      >
        {children}
      </motion.div>
    </motion.section>
  );
}

const LUMI_CHIPS = [
  {
    label: "O que leio hoje?",
    prompt:
      "Com base no meu momento, me indique um livro de domínio público para começar hoje e diga por quê, em poucas linhas.",
  },
  {
    label: "Algo curto",
    prompt:
      "Me sugira três leituras curtas (menos de 2 horas) de domínio público, com uma frase sobre cada.",
  },
  {
    label: "Montar um hábito",
    prompt:
      "Me ajude a montar um hábito de leitura de 20 minutos por dia: um plano simples para esta semana.",
  },
];

/** Lumi's pick of the day — her note plus quick questions that open the chat. */
function LumiTodayCard({ pick, delay }: { pick: LumiPick; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0.55, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className="mt-6 overflow-hidden rounded-[28px] bg-accent-soft p-4 sm:p-5 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10 lg:p-7"
    >
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <Lumi pose="reading" size={54} shadow={false} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-gold">
              <Sparkles className="h-3.5 w-3.5" /> A Lumi indica hoje
            </p>
            <Link
              to="/reader/$bookId"
              params={{ bookId: gutenbergReaderId(pick.gutenbergId) }}
              className="mt-1 block font-display text-[20px] leading-tight hover:underline"
            >
              {pick.title}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted-foreground">
              <LangTag code={pick.lang} />
              <span>
                {pick.author} · {formatMinutes(pick.minutes)} · {pick.mood}
              </span>
            </p>
          </div>
        </div>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-foreground/85 lg:text-[15px]">
          “{pick.lumiNote}”
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Link
            to="/reader/$bookId"
            params={{ bookId: gutenbergReaderId(pick.gutenbergId) }}
            className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background"
          >
            <BookOpen className="h-4 w-4" /> Ler agora
          </Link>
          <button
            type="button"
            onClick={() =>
              openLumiPanel({
                topic: "question",
                bookTitle: pick.title,
                bookAuthor: pick.author,
                initialPrompt: `Sem spoilers: por que eu deveria ler “${pick.title}”, de ${pick.author}? O que observar enquanto leio?`,
              })
            }
            className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--border)]"
          >
            <Sparkles className="h-3.5 w-3.5 text-gold" /> Por que ler?
          </button>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {LUMI_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => openLumiPanel({ topic: "general", initialPrompt: c.prompt })}
              className="press shrink-0 rounded-full border border-gold/30 bg-card/60 px-3 py-1.5 text-[12.5px] font-semibold text-foreground/80"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <Link
        to="/reader/$bookId"
        params={{ bookId: gutenbergReaderId(pick.gutenbergId) }}
        aria-label={`Ler ${pick.title}`}
        className="hidden w-[132px] rotate-[3deg] transition-transform duration-300 hover:rotate-0 hover:scale-[1.03] lg:block"
      >
        <BookArt title={pick.title} author={pick.author} lift live />
      </Link>
    </motion.section>
  );
}

function BookTile({
  title,
  author,
  cover,
  meta,
  readerId,
  lang,
}: {
  title: string;
  author?: string;
  cover?: string | null;
  meta?: string;
  readerId?: string;
  lang?: string | null;
}) {
  const inner = (
    <>
      <BookArt title={title} author={author} cover={cover} live />
      <p className="mt-2.5 truncate text-[13.5px] font-semibold tracking-[-0.01em]">{title}</p>
      {(meta || lang) && (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-faint">
          {lang && <LangTag code={lang} />}
          {meta && <span className="truncate">{meta}</span>}
        </p>
      )}
    </>
  );
  const cls = "press w-[104px] shrink-0 snap-start lg:w-[132px]";
  return readerId ? (
    <Link to="/reader/$bookId" params={{ bookId: readerId }} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function ContinueCard({
  entry,
  progress,
}: {
  entry: LibraryEntry;
  progress?: StoredReadingProgress;
}) {
  const pal = bookPalette(entry.title, entry.author);
  const ratio = progressRatio(progress);
  const pct = Math.round(ratio * 100);
  const chapter = progress?.chapterIndex != null ? progress.chapterIndex + 1 : null;
  const total = progress?.chapterCount;
  const [live, setLive] = useState<ReturnType<typeof getLastBookInfo>>(null);
  useEffect(() => setLive(getLastBookInfo()), []);
  const mine = live?.id === entry.readerId ? live : null;
  const footnote =
    mine?.chapterMinutesLeft != null
      ? `${formatMinutes(mine.chapterMinutesLeft)} para o fim do capítulo${
          mine.bookMinutesLeft != null ? ` · ${formatMinutes(mine.bookMinutesLeft)} no total` : ""
        }`
      : total
        ? `Capítulo ${chapter} de ${total}`
        : null;
  return (
    <div
      className="relative overflow-hidden rounded-[30px] p-[18px] lg:flex lg:h-full lg:gap-7 lg:p-7"
      style={{ background: pal.bg, color: pal.fg }}
    >
      <span
        aria-hidden
        className="absolute -right-10 -top-10 h-[200px] w-[200px] rounded-full opacity-[.14] lg:h-[320px] lg:w-[320px]"
        style={{ background: pal.accent }}
      />
      <div className="relative flex items-end gap-4 lg:contents">
        <Link
          to="/reader/$bookId"
          params={{ bookId: entry.readerId! }}
          className="press w-24 shrink-0 lg:w-[150px]"
          aria-label={`Abrir ${entry.title}`}
        >
          <BookArt title={entry.title} author={entry.author} cover={entry.cover} lift eager live />
        </Link>
        <div className="min-w-0 flex-1 pb-0.5 lg:flex lg:flex-col">
          <p
            className="text-[11px] font-semibold tracking-[0.12em] lg:text-xs"
            style={{ color: pal.accent }}
          >
            CONTINUE LENDO
          </p>
          <h2 className="mt-2 line-clamp-2 text-[27px] leading-[0.98] lg:text-[40px]">
            {entry.title}
          </h2>
          <p className="mt-1 truncate text-[13.5px] opacity-75 lg:text-base">
            {entry.author}
            {mine?.chapter ? (
              <span className="hidden lg:inline"> · {mine.chapter}</span>
            ) : chapter ? (
              <span className="hidden lg:inline"> · Capítulo {chapter}</span>
            ) : null}
          </p>
          <div className="hidden flex-1 lg:block" />
          <div className="mt-3.5 flex items-center gap-2.5 text-[12.5px] font-semibold">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ background: `${pal.fg}2e` }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: pal.accent }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: EASE, delay: 0.3 }}
              />
            </div>
            <span className="lg:hidden">{pct}%</span>
            <span className="hidden lg:inline">
              {pct}%
              {mine?.bookMinutesLeft != null
                ? ` · ${formatMinutes(mine.bookMinutesLeft)} restantes`
                : ""}
            </span>
          </div>
          <div className="mt-4 hidden gap-2.5 lg:flex">
            <ContinueButtons entry={entry} pal={pal} chapter={chapter} />
          </div>
        </div>
      </div>
      <div className="relative mt-4 flex gap-2 lg:hidden">
        <ContinueButtons entry={entry} pal={pal} chapter={chapter} />
      </div>
      {footnote ? (
        <p className="relative mt-2.5 text-center text-xs opacity-70 lg:hidden">{footnote}</p>
      ) : null}
    </div>
  );
}

function ContinueButtons({
  entry,
  pal,
  chapter,
}: {
  entry: LibraryEntry;
  pal: { bg: string; fg: string };
  chapter: number | null;
}) {
  return (
    <>
      <Link
        to="/reader/$bookId"
        params={{ bookId: entry.readerId! }}
        className="press inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[15px] font-semibold max-[359px]:px-3 max-[359px]:text-[14px] lg:flex-none"
        style={{ background: pal.fg, color: pal.bg }}
      >
        <BookOpen className="h-[18px] w-[18px]" strokeWidth={2.2} />
        <span className="truncate lg:hidden">
          {chapter ? `Continuar · Cap. ${chapter}` : "Continuar leitura"}
        </span>
        <span className="hidden lg:inline">Continuar leitura</span>
      </Link>
      <Link
        to="/reader/$bookId"
        params={{ bookId: entry.readerId! }}
        search={{ ouvir: 1 } as never}
        aria-label="Ouvir"
        className="press inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-white/15 lg:w-auto lg:px-5"
      >
        <Headphones className="h-[19px] w-[19px]" />
        <span className="hidden text-[15px] font-semibold lg:inline">Ouvir</span>
      </Link>
    </>
  );
}

function StartCard() {
  return (
    <div className="surface-card relative flex h-full flex-col items-center overflow-hidden p-6 text-center lg:flex-row lg:gap-8 lg:p-8 lg:text-left">
      <Lumi pose="reading" size={150} bob />
      <div className="min-w-0 flex-1">
        <h2 className="mt-3 text-[26px] leading-tight lg:mt-0 lg:text-[34px]">
          Seu próximo livro começa aqui
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Escolha um clássico grátis ou traga seus EPUBs e PDFs. A Lumi guarda a página para você.
        </p>
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:justify-start">
          <Link to="/descobrir" search={DISCOVER_SEARCH} className="btn-primary">
            <Compass className="h-[18px] w-[18px]" /> Explorar livros grátis
          </Link>
          <Link to="/biblioteca" className="btn-ghost">
            <FileUp className="h-[18px] w-[18px]" /> Importar arquivo
          </Link>
        </div>
      </div>
    </div>
  );
}
