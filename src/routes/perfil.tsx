import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Download,
  Flame,
  NotebookPen,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { User } from "firebase/auth";

import { Lumi } from "@/components/brand/lumi";
import { UserAvatar } from "@/components/user-avatar";
import { useAccount } from "@/hooks/use-auth-user";
import { getLevelInfo } from "@/lib/achievements";
import { computeGoalProgress, currentYear, subscribeReadingGoal } from "@/lib/goals";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { getLocalOnboarding, type ReadingMoment } from "@/lib/onboarding";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { dayKey, useRitual, type RitualDays } from "@/lib/ritual";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Você — BookVerse" },
      { name: "description", content: "Sua sequência, horas lidas, semana e conquistas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VocePage,
});

function VocePage() {
  const { state, user } = useAccount();
  if (state === "loading") return <VoceSkeleton />;
  if (state === "guest" || !user) return <GuestVoce />;
  return <MemberVoce user={user} />;
}

function VoceSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] lg:pt-10"
      aria-busy="true"
    >
      <div className="mx-[6px] mt-2 h-11 w-32 animate-pulse rounded-xl bg-surface-2" />
      <div className="mt-6 flex items-center gap-4 px-[6px]">
        <div className="h-[62px] w-[62px] animate-pulse rounded-full bg-surface-2" />
        <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="mt-5 h-[300px] animate-pulse rounded-[30px] bg-surface-2" />
    </div>
  );
}

const MOMENT: Record<ReadingMoment, string> = {
  manha: "Leitura matinal",
  tarde: "Leitura à tarde",
  noite: "Leitura noturna",
  qualquer: "Leitura a qualquer hora",
};

function sinceYear(createdAt: unknown): number | null {
  const t = createdAt as { toDate?: () => Date; seconds?: number } | null;
  const d = t?.toDate?.() ?? (t?.seconds ? new Date(t.seconds * 1000) : null);
  return d ? d.getFullYear() : null;
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}

const nf = new Intl.NumberFormat("pt-BR");

function MemberVoce({ user }: { user: User }) {
  const reduce = useReducedMotion();
  const year = currentYear();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [goal, setGoal] = useState<number | null>(null);
  const [moment, setMoment] = useState<ReadingMoment | null>(null);
  const ritual = useRitual(user.uid);

  useEffect(() => {
    setMoment(getLocalOnboarding(user.uid)?.moment ?? null);
    const unsubs = [
      subscribeUserProfile(user.uid, (p) => {
        setProfile(p);
        setReady(true);
      }),
      subscribeLibrary(user.uid, setLibrary),
      subscribeReadingGoal(user.uid, year, (g) => setGoal(g?.books ?? null)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user.uid, year]);

  const name = profile?.displayName || user.displayName || "Leitor";
  const since = sinceYear(profile?.createdAt);
  const persona = moment ? MOMENT[moment] : `Nível ${getLevelInfo(profile?.xp ?? 0).level}`;

  const streak = profile?.currentStreak ?? 0;
  const record = Math.max(profile?.longestStreak ?? 0, streak);
  const readToday = ritual.todayMinutes > 0 || profile?.lastActiveDate === dayKey();

  const yearMinutes = useMemo(() => {
    const fromDays = Object.entries(ritual.days)
      .filter(([k]) => k.startsWith(`${year}-`))
      .reduce((s, [, v]) => s + v, 0);
    return Math.max(fromDays, profile?.readingMinutes ?? 0);
  }, [ritual.days, year, profile?.readingMinutes]);

  const weekTotal = ritual.week.reduce((s, d) => s + d.minutes, 0);
  const lastWeekTotal = useMemo(() => {
    let sum = 0;
    for (const d of ritual.week) {
      const prev = new Date(`${d.key}T12:00:00`);
      prev.setDate(prev.getDate() - 7);
      sum += ritual.days[dayKey(prev)] ?? 0;
    }
    return sum;
  }, [ritual.week, ritual.days]);
  const delta =
    lastWeekTotal > 0 ? Math.round(((weekTotal - lastWeekTotal) / lastWeekTotal) * 100) : null;

  const goalProgress = goal ? computeGoalProgress(library, goal) : null;
  const rise = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0.55, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: d, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="mx-auto max-w-3xl pb-10 pt-[calc(env(safe-area-inset-top)+0.875rem)] lg:pt-10">
      <header className="flex items-center justify-between px-[22px] pt-2">
        <h1 className="font-display text-[44px] leading-none tracking-[-0.035em] lg:text-[56px]">
          Você
        </h1>
        <Link
          to="/ajustes"
          aria-label="Ajustes"
          className="press grid h-[46px] w-[46px] place-items-center rounded-full bg-card shadow-[inset_0_0_0_1px_var(--border)]"
        >
          <Settings className="h-[21px] w-[21px]" strokeWidth={2} />
        </Link>
      </header>

      <motion.div {...rise(0)} className="mt-5 flex items-center gap-4 px-[22px]">
        <UserAvatar
          profile={profile}
          user={user}
          size="lg"
          allowProviderFallback={ready}
          className="!h-[62px] !w-[62px] !text-[26px]"
        />
        <div className="min-w-0">
          <p className="truncate text-[20px] font-bold tracking-[-0.01em]">{name}</p>
          <p className="mt-0.5 truncate text-[14.5px] text-muted-foreground">
            {persona}
            {since ? ` · desde ${since}` : ""}
          </p>
        </div>
      </motion.div>

      {/* Streak */}
      <motion.section
        {...rise(0.05)}
        className="relative mx-4 mt-5 overflow-hidden rounded-[30px] bg-[linear-gradient(150deg,#ff6a3d,var(--gold)_55%,#e8400f)] px-5 pb-5 pt-5 text-white shadow-[0_14px_32px_-14px_rgba(255,77,26,.55)]"
      >
        <Flame
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-6 h-[150px] w-[150px] text-white/20"
          strokeWidth={1.6}
        />
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em]">
          <Flame className="h-4 w-4" strokeWidth={2.2} /> Sequência
        </p>
        <p className="mt-1.5 font-display text-[52px] leading-none tracking-[-0.04em] sm:text-[58px]">
          {streak} {streak === 1 ? "dia" : "dias"}
        </p>
        <p className="mt-2.5 text-[15px] text-white/90">
          {streak === 0
            ? "Leia alguns minutos hoje para começar."
            : readToday
              ? `Você já leu hoje. Seu recorde é ${record}.`
              : `Seu recorde é ${record}. Leia hoje para manter.`}
        </p>
        <WeekDots week={ritual.week} />
      </motion.section>

      {/* Rhythm heatmap — on a neutral card so the levels are easy to read */}
      <motion.section {...rise(0.08)} className="surface-card mx-4 mt-3 px-4 pb-4 pt-4 sm:px-5">
        <Heatmap days={ritual.days} goal={ritual.goal} />
      </motion.section>

      {/* Stats */}
      <motion.div {...rise(0.1)} className="mx-4 mt-3 grid grid-cols-3 gap-2.5">
        <Stat value={`${Math.floor(yearMinutes / 60)}h`} label={`lidas em ${year}`} />
        <Stat value={nf.format(profile?.pagesRead ?? 0)} label="páginas" />
        <Stat
          value={nf.format(profile?.booksCompleted ?? 0)}
          label={(profile?.booksCompleted ?? 0) === 1 ? "livro lido" : "livros lidos"}
        />
      </motion.div>

      {/* Week */}
      <motion.section {...rise(0.15)} className="surface-card mx-4 mt-3 px-5 pb-4 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-bold tracking-[-0.01em]">Esta semana</h2>
          <p className="num text-[13.5px] text-muted-foreground">
            {fmtMinutes(weekTotal)}
            {delta !== null && ` · ${delta >= 0 ? "+" : ""}${delta}%`}
          </p>
        </div>
        <WeekBars week={ritual.week} />
        <button
          type="button"
          onClick={() =>
            openLumiPanel({
              topic: "general",
              initialPrompt: `Analise meu ritmo de leitura e me dê 3 dicas práticas e curtas. Dados: ${Math.round(weekTotal)} min lidos nesta semana, sequência atual de ${streak} dia(s), recorde de ${record}, meta diária de ${ritual.goal} min, ${profile?.booksCompleted ?? 0} livro(s) concluído(s).`,
            })
          }
          className="press mt-4 flex w-full items-center gap-3 rounded-[18px] bg-accent-soft px-3.5 py-2.5 text-left"
        >
          <Lumi pose="hello" size={36} shadow={false} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Lumi, como está meu ritmo?</span>
            <span className="block truncate text-[12px] text-muted-foreground">
              Uma análise rápida da sua semana, com dicas
            </span>
          </span>
          <Sparkles className="h-4 w-4 shrink-0 text-gold" />
        </button>
      </motion.section>

      {/* Goal */}
      <motion.div {...rise(0.2)}>
        <Link
          to="/metas"
          className="surface-card press mx-4 mt-3 flex items-center gap-4 px-5 py-4"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-accent-soft text-gold">
            <Target className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-semibold">Meta de {year}</p>
            {goalProgress ? (
              <>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {goalProgress.completed} de {goalProgress.target} livros
                  {goalProgress.remaining > 0
                    ? ` · ${goalProgress.perMonthNeeded} por mês para chegar lá`
                    : " · meta batida!"}
                </p>
                <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-accent-soft">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${Math.max(3, goalProgress.percent)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Defina quantos livros quer ler este ano
              </p>
            )}
          </div>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-faint" />
        </Link>
      </motion.div>

      <motion.ul {...rise(0.25)} className="surface-card mx-4 mt-3 px-4">
        <Row
          to="/desafios"
          icon={Trophy}
          tint="var(--butter)"
          label="Desafios e conquistas"
          hint={`Nível ${getLevelInfo(profile?.xp ?? 0).level} · ${nf.format(profile?.xp ?? 0)} XP`}
        />
        <Row
          to="/diario"
          icon={NotebookPen}
          tint="var(--lilac)"
          label="Diário de leitura"
          hint="suas notas e trechos"
        />
        <Row
          to="/ranking"
          icon={Users}
          tint="var(--sky)"
          label="Ranking"
          hint="leitores da comunidade"
        />
        <Row
          to="/downloads"
          icon={Download}
          tint="var(--mint)"
          label="Downloads e arquivos"
          hint="livros neste aparelho"
        />
        <Row
          to="/ajustes"
          icon={Settings}
          tint="var(--surface-2)"
          label="Ajustes"
          hint="perfil, aparência e conta"
          last
        />
      </motion.ul>
    </div>
  );
}

/* ------------------------------- pieces -------------------------------- */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface-card min-w-0 rounded-[24px] px-3 py-3.5">
      <p className="num font-display text-[26px] leading-none tracking-[-0.03em]">{value}</p>
      <p className="mt-2 whitespace-nowrap text-[12.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

const WEEKS = 17;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAY_ROWS = ["S", "", "Q", "", "S", "", "D"];

/** This week as seven big, readable day markers inside the streak card. */
function WeekDots({
  week,
}: {
  week: { key: string; label: string; minutes: number; today: boolean }[];
}) {
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5 rounded-[20px] bg-black/10 p-2">
      {week.map((d) => {
        const read = d.minutes > 0;
        return (
          <div key={d.key} className="flex flex-col items-center gap-1.5 py-1">
            <span className="text-[11.5px] font-bold uppercase text-white/80">{d.label}</span>
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold transition ${
                read
                  ? "bg-white text-gold"
                  : d.today
                    ? "border-2 border-dashed border-white/80 text-white"
                    : "bg-white/15 text-white/60"
              }`}
              title={read ? `${d.minutes} min` : "Sem leitura"}
            >
              {read ? <Flame className="h-4 w-4" strokeWidth={2.4} /> : d.today ? "hoje" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Last ~4 months of reading, one cell per day (Monday on top). */
function Heatmap({ days, goal }: { days: RitualDays; goal: number }) {
  const { cells, months, readDays } = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const start = new Date(monday);
    start.setDate(monday.getDate() - (WEEKS - 1) * 7);
    const todayKey = dayKey(today);
    const out: { key: string; level: number; future: boolean; today: boolean; minutes: number }[] =
      [];
    const monthMarks: { col: number; label: string }[] = [];
    let count = 0;
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        if (d === 0 && (w === 0 || date.getDate() <= 7)) {
          const label = MONTHS[date.getMonth()];
          if (!monthMarks.some((m) => m.label === label)) monthMarks.push({ col: w, label });
        }
        const key = dayKey(date);
        const m = days[key] ?? 0;
        const future = date > today && key !== todayKey;
        if (m > 0 && !future) count++;
        out.push({
          key,
          minutes: m,
          level: m <= 0 ? 0 : m < goal / 2 ? 1 : m < goal ? 2 : m < goal * 2 ? 3 : 4,
          future,
          today: key === todayKey,
        });
      }
    }
    // Drop a first-column label that would collide with the next one.
    if (monthMarks.length > 1 && monthMarks[1].col - monthMarks[0].col < 3) monthMarks.shift();
    return { cells: out, months: monthMarks, readDays: count };
  }, [days, goal]);

  const SHADE = [
    "var(--surface-2)",
    "color-mix(in srgb, var(--gold) 28%, var(--surface-2))",
    "color-mix(in srgb, var(--gold) 52%, var(--surface-2))",
    "color-mix(in srgb, var(--gold) 76%, var(--surface-2))",
    "var(--gold)",
  ];
  const fmt = (key: string) => {
    const [y, mo, d] = key.split("-").map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">Seu ritmo</h2>
        <p className="num text-[13px] text-muted-foreground">
          {readDays} {readDays === 1 ? "dia" : "dias"} de leitura
        </p>
      </div>
      <div className="mt-3 flex gap-1.5">
        <div
          className="grid shrink-0 gap-[3px] pt-[18px] text-[9.5px] font-semibold leading-none text-faint"
          style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
          aria-hidden
        >
          {WEEKDAY_ROWS.map((l, i) => (
            <span key={i} className="flex items-center">
              {l}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative mb-1.5 h-3 text-[10px] font-semibold leading-none text-faint"
            aria-hidden
          >
            {months.map((m) => (
              <span
                key={m.label + m.col}
                className="absolute top-0"
                style={{ left: `${(m.col / WEEKS) * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col gap-[3px]"
            style={{
              gridTemplateRows: "repeat(7, minmax(0, 1fr))",
              gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
            }}
            aria-label={`${readDays} dias de leitura nas últimas ${WEEKS} semanas`}
            role="img"
          >
            {cells.map((c) => (
              <span
                key={c.key}
                title={
                  c.future
                    ? undefined
                    : `${fmt(c.key)} · ${c.minutes ? `${c.minutes} min` : "sem leitura"}`
                }
                className={`aspect-square rounded-[4px] ${c.today ? "ring-2 ring-foreground/70 ring-offset-1 ring-offset-card" : ""}`}
                style={{
                  background: c.future ? "transparent" : SHADE[c.level],
                  boxShadow: c.future ? "inset 0 0 0 1px var(--border)" : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-faint">
        <span>Menos</span>
        {SHADE.map((bg, i) => (
          <i key={i} className="h-3 w-3 rounded-[3px]" style={{ background: bg }} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  );
}

function WeekBars({
  week,
}: {
  week: { key: string; label: string; minutes: number; today: boolean }[];
}) {
  const max = Math.max(1, ...week.map((d) => d.minutes));
  return (
    <div className="mt-4 grid grid-cols-7 gap-2.5">
      {week.map((d) => {
        const h = 26 + Math.round((d.minutes / max) * 82);
        return (
          <div key={d.key} className="flex flex-col items-center">
            <div className="flex h-[108px] w-full items-end">
              <motion.div
                initial={{ height: 20 }}
                animate={{ height: h }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                title={`${d.minutes} min`}
                className={`w-full rounded-[12px] ${d.today ? "bg-gold" : "bg-surface-2"}`}
              />
            </div>
            <span
              className={`mt-2 text-[12.5px] font-semibold ${d.today ? "text-foreground" : "text-faint"}`}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  to,
  icon: Icon,
  tint,
  label,
  hint,
  last,
}: {
  to: "/desafios" | "/diario" | "/ranking" | "/downloads" | "/ajustes";
  icon: typeof Trophy;
  tint: string;
  label: string;
  hint: string;
  last?: boolean;
}) {
  return (
    <li className={last ? "" : "border-b border-border"}>
      <Link to={to} className="press flex items-center gap-3.5 py-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] text-[#131313]"
          style={{ background: tint }}
        >
          <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{label}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{hint}</p>
        </div>
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-faint" />
      </Link>
    </li>
  );
}

/* -------------------------------- guest -------------------------------- */

function GuestVoce() {
  return (
    <div className="mx-auto max-w-3xl pb-10 pt-[calc(env(safe-area-inset-top)+0.875rem)] lg:pt-10">
      <header className="px-[22px] pt-2">
        <h1 className="font-display text-[44px] leading-none tracking-[-0.035em] lg:text-[56px]">
          Você
        </h1>
      </header>
      <section className="mx-4 mt-5 overflow-hidden rounded-[30px] bg-gold px-6 pb-6 pt-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em]">
              <Flame className="h-4 w-4" /> Sua sequência
            </p>
            <p className="mt-2 font-display text-[30px] leading-[1.05] tracking-[-0.03em]">
              Guarde seus dias de leitura
            </p>
          </div>
          <Lumi pose="celebrating" size={92} />
        </div>
        <p className="mt-2 text-[14.5px] text-white/90">
          Com uma conta grátis, sua sequência, horas lidas, metas e estante ficam salvas em todos os
          aparelhos.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/auth"
            search={{ redirect: "/perfil" }}
            className="press inline-flex h-11 items-center rounded-full bg-white px-5 text-[14.5px] font-semibold text-[#131313]"
          >
            Criar conta grátis
          </Link>
          <Link
            to="/auth"
            search={{ redirect: "/perfil" }}
            className="press inline-flex h-11 items-center rounded-full bg-white/20 px-5 text-[14.5px] font-semibold"
          >
            Já tenho conta
          </Link>
        </div>
      </section>
      <ul className="surface-card mx-4 mt-3 px-4">
        <Row
          to="/downloads"
          icon={Download}
          tint="var(--mint)"
          label="Downloads e arquivos"
          hint="livros neste aparelho"
        />
        <Row
          to="/desafios"
          icon={Trophy}
          tint="var(--butter)"
          label="Desafios"
          hint="veja o que dá para conquistar"
          last
        />
      </ul>
    </div>
  );
}
