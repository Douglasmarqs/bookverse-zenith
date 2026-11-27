/**
 * Ranking — the club's scoreboard as a little show: leagues by level, a
 * podium that rises with a crown on top, your rival named (the reader
 * right above you) with exactly how much is missing, a live countdown to
 * the weekly and monthly reset and a "you" bar that follows you when your
 * row scrolls away. Weekly/monthly scores from past periods are ignored.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Flame, Swords, Timer, Trophy } from "lucide-react";
import type { User } from "firebase/auth";

import { Lumi } from "@/components/brand/lumi";
import { TopBar } from "@/components/shell/top-bar";
import { UserAvatar } from "@/components/user-avatar";
import { getLevelInfo } from "@/lib/achievements";
import { subscribeAuth } from "@/lib/firebase";
import { periodEnd, subscribeRanking, type RankingMetric, type RankingRow } from "@/lib/ranking";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — BookVerse" },
      {
        name: "description",
        content: "Ranking de leitura com dados reais da comunidade BookVerse.",
      },
    ],
  }),
  component: RankingPage,
});

const METRICS: { id: RankingMetric; label: string; unit: string; one: string }[] = [
  { id: "weeklyXp", label: "Semana", unit: "XP", one: "XP" },
  { id: "monthlyXp", label: "Mês", unit: "XP", one: "XP" },
  { id: "xp", label: "Geral", unit: "XP", one: "XP" },
  { id: "currentStreak", label: "Sequência", unit: "dias", one: "dia" },
  { id: "chaptersRead", label: "Capítulos", unit: "capítulos", one: "capítulo" },
  { id: "booksCompleted", label: "Livros", unit: "livros", one: "livro" },
];

const LEAGUES = [
  { min: 30, name: "Lenda", color: "#b06df6" },
  { min: 20, name: "Diamante", color: "#4fb3ef" },
  { min: 15, name: "Esmeralda", color: "#1fa67a" },
  { min: 10, name: "Ouro", color: "#e0b43a" },
  { min: 5, name: "Prata", color: "#a7afbd" },
  { min: 1, name: "Bronze", color: "#c9834b" },
];

function league(xp: number) {
  const level = getLevelInfo(xp).level;
  const i = LEAGUES.findIndex((l) => level >= l.min);
  const l = LEAGUES[i] ?? LEAGUES[LEAGUES.length - 1]!;
  const next = i > 0 ? LEAGUES[i - 1] : null;
  return { ...l, level, next };
}

const PODIUM = {
  1: { h: 128, color: "#e0b43a", glow: "0 0 36px -6px #e0b43a" },
  2: { h: 96, color: "#b9c0cc", glow: "none" },
  3: { h: 78, color: "#c9834b", glow: "none" },
} as const;

function amount(value: number, m: (typeof METRICS)[number]) {
  return `${value.toLocaleString("pt-BR")} ${value === 1 ? m.one : m.unit}`;
}

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return setN(value);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 800);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <>{n.toLocaleString("pt-BR")}</>;
}

function useCountdown(metric: RankingMetric) {
  const kind = metric === "weeklyXp" ? "week" : metric === "monthlyXp" ? "month" : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!kind) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [kind]);
  if (!kind) return null;
  const left = Math.max(0, periodEnd(kind).getTime() - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return {
    kind,
    text: d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`,
    urgent: left < 86_400_000,
  };
}

function RankingPage() {
  const reduce = useReducedMotion();
  const [metric, setMetric] = useState<RankingMetric>("weeklyXp");
  const [rows, setRows] = useState<RankingRow[] | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const m = METRICS.find((x) => x.id === metric)!;
  const countdown = useCountdown(metric);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    setRows(undefined);
    return subscribeRanking(50, setRows, metric);
  }, [metric]);
  useEffect(() => {
    const timer = setTimeout(() => setRows((c) => (c === undefined ? null : c)), 10000);
    return () => clearTimeout(timer);
  }, [metric]);

  const signedIn = !!user && !user.isAnonymous;
  const isMe = (r: RankingRow) => signedIn && r.uid === user!.uid;
  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  const me = rows?.find(isMe);
  const rival = me && rows ? rows[me.pos - 2] : undefined;
  const chaser = me && rows ? rows[me.pos] : undefined;
  const gap = me && rival ? Math.max(0, rival.value - me.value) + 1 : null;

  // A bar that follows you when your row is off-screen.
  const myRowRef = useRef<HTMLLIElement | null>(null);
  const [myRowVisible, setMyRowVisible] = useState(true);
  useEffect(() => {
    const el = myRowRef.current;
    if (!el) return setMyRowVisible(true);
    const io = new IntersectionObserver(([e]) => setMyRowVisible(!!e?.isIntersecting), {
      rootMargin: "0px 0px -80px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rows, me?.uid]);

  const quip = useMemo(() => {
    if (!rows || rows.length === 0)
      return "Ninguém pontuou ainda. O primeiro capítulo vale o pódio inteiro.";
    if (!signedIn) return "Entre com sua conta para aparecer no ranking — eu guardo o seu lugar.";
    if (!me) return "Você ainda não entrou nesta lista. Um capítulo hoje já te coloca no mapa.";
    if (me.pos === 1)
      return "Primeiro lugar. Todo mundo está lendo para te alcançar — não para agora.";
    if (me.pos <= 3) return `Pódio! ${rival?.displayName ?? "O próximo"} está logo ali.`;
    if (gap !== null && gap <= 30) return "Tá perto demais pra parar. Um capítulo e você sobe.";
    return "Constância vence velocidade. Leia um pouco todo dia e veja a lista mudar.";
  }, [rows, signedIn, me, rival, gap]);

  return (
    <main className="mx-auto max-w-3xl pb-32 lg:pt-10">
      <TopBar title="Ranking" fallback="/perfil" className="mb-1" />

      {/* ── Metric tabs ──────────────────────────────────────────────── */}
      <LayoutGroup id="rank-tabs">
        <div className="no-scrollbar mx-4 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
          {METRICS.map((item) => {
            const on = item.id === metric;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMetric(item.id);
                  navigator.vibrate?.(6);
                }}
                aria-pressed={on}
                className={`relative h-9 shrink-0 grow whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-semibold transition-colors ${
                  on ? "text-background" : "text-muted-foreground"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="rank-tab"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    className="absolute inset-0 rounded-full bg-foreground"
                  />
                )}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {countdown && (
        <p
          className={`mx-4 mt-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold ${
            countdown.urgent ? "text-[#e0431a]" : "text-muted-foreground"
          }`}
        >
          <Timer className="h-4 w-4" />
          {countdown.kind === "week" ? "A semana fecha em" : "O mês fecha em"}{" "}
          <span className="num">{countdown.text}</span>
          {countdown.urgent && " — última chance!"}
        </p>
      )}

      {/* ── You ──────────────────────────────────────────────────────── */}
      {signedIn && rows && (
        <YouCard me={me} rival={rival} chaser={chaser} gap={gap} m={m} total={rows.length} />
      )}
      {!signedIn && user !== null && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-[24px] bg-surface-2 p-4">
          <Trophy className="h-6 w-6 shrink-0 text-gold" />
          <p className="flex-1 text-[13.5px] text-muted-foreground">
            Entre para aparecer no ranking e ganhar uma liga.
          </p>
          <Link
            to="/auth"
            search={{ redirect: "/ranking" }}
            className="press h-9 shrink-0 rounded-full bg-foreground px-4 text-[13px] font-semibold leading-9 text-background"
          >
            Entrar
          </Link>
        </div>
      )}

      {rows === undefined ? (
        <PodiumSkeleton />
      ) : rows === null ? (
        <Message text="Não foi possível carregar o ranking agora." />
      ) : rows.length === 0 ? (
        <Message
          lumi
          text={
            countdown
              ? `Ninguém pontuou ${countdown.kind === "week" ? "nesta semana" : "neste mês"} ainda. O primeiro capítulo vale o pódio.`
              : "Ainda não há dados suficientes nesta métrica."
          }
        />
      ) : (
        <>
          {/* ── Podium ───────────────────────────────────────────────── */}
          <div key={metric} className="mx-4 mt-8 grid grid-cols-3 items-end gap-2.5">
            {([2, 1, 3] as const).map((place) => {
              const row = podium[place - 1];
              return row ? (
                <Pedestal
                  key={row.uid}
                  row={row}
                  place={place}
                  me={isMe(row)}
                  m={m}
                  reduce={!!reduce}
                />
              ) : (
                <div key={`empty-${place}`} />
              );
            })}
          </div>

          {/* ── The rest ─────────────────────────────────────────────── */}
          {rest.length > 0 && (
            <ol className="surface-card mx-4 mt-4 overflow-hidden rounded-[26px] p-1.5">
              <AnimatePresence initial={false}>
                {rest.map((row, i) => {
                  const mine = isMe(row);
                  const isRival = rival?.uid === row.uid;
                  const lg = league(row.xp);
                  return (
                    <motion.li
                      key={row.uid}
                      ref={mine ? myRowRef : undefined}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.025 }}
                      className={`flex items-center gap-3 rounded-[20px] px-3 py-2.5 ${
                        mine ? "bg-gold/12 ring-1 ring-gold/40" : ""
                      }`}
                    >
                      <span
                        className={`num w-7 shrink-0 text-center text-[14px] font-bold ${
                          mine ? "text-gold" : "text-muted-foreground"
                        }`}
                      >
                        {row.pos}
                      </span>
                      <span className="relative shrink-0">
                        <UserAvatar profile={row} size="sm" />
                        <span
                          aria-hidden
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card"
                          style={{ background: lg.color }}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[14.5px] ${mine ? "font-bold" : "font-semibold"}`}
                        >
                          {mine ? "Você" : row.displayName}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <span style={{ color: lg.color }} className="font-semibold">
                            {lg.name}
                          </span>
                          · Nv. {lg.level}
                          {isRival && (
                            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-[#e0431a]/12 px-1.5 py-px font-bold text-[#e0431a]">
                              <Swords className="h-3 w-3" /> rival
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="num shrink-0 text-right text-[14px] font-bold">
                        {row.value.toLocaleString("pt-BR")}
                        <span className="block text-[10.5px] font-medium text-faint">{m.unit}</span>
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          )}
        </>
      )}

      <div className="mx-4 mt-6 flex items-center gap-3 rounded-[24px] bg-surface-2 p-4">
        <Lumi pose="idle" size={50} shadow={false} />
        <p className="text-[13.5px] leading-snug text-muted-foreground">{quip}</p>
      </div>

      {/* ── Follows you when your row is off-screen ────────────────────── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {me && me.pos > 3 && !myRowVisible && (
              <motion.button
                type="button"
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                onClick={() =>
                  myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] z-30 mx-auto flex max-w-[560px] items-center gap-3 rounded-full bg-[#141414] py-2 pl-2 pr-4 text-left text-white shadow-2xl lg:bottom-8"
              >
                <UserAvatar profile={me} size="sm" />
                <span className="num text-[15px] font-bold">{me.pos}º</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
                  {gap !== null && rival
                    ? `Faltam ${amount(gap, m)} para passar ${rival.displayName}`
                    : "Você"}
                </span>
                <span className="num text-[14px] font-bold text-[#d7f53a]">
                  {me.value.toLocaleString("pt-BR")}
                </span>
              </motion.button>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </main>
  );
}

function YouCard({
  me,
  rival,
  chaser,
  gap,
  m,
  total,
}: {
  me: RankingRow | undefined;
  rival: RankingRow | undefined;
  chaser: RankingRow | undefined;
  gap: number | null;
  m: (typeof METRICS)[number];
  total: number;
}) {
  if (!me) {
    return (
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-[24px] bg-[#141414] p-4 text-white">
        <Flame className="h-6 w-6 shrink-0 text-[#d7f53a]" />
        <p className="text-[13.5px] text-white/80">
          {total >= 50
            ? "Você ainda está fora do top 50 aqui. Cada capítulo lido te aproxima."
            : "Você ainda não pontuou nesta lista. Leia um capítulo e entre no jogo."}
        </p>
      </div>
    );
  }
  const lg = league(me.xp);
  const lead = me.pos === 1 && chaser ? me.value - chaser.value : null;
  const toward = rival ? Math.min(1, me.value / Math.max(1, rival.value + 1)) : 1;
  return (
    <motion.div
      layout
      className="relative mx-4 mt-4 overflow-hidden rounded-[28px] bg-[#141414] p-5 text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-40 blur-3xl"
        style={{ background: `radial-gradient(circle, ${lg.color}, transparent 70%)` }}
      />
      <div className="relative flex items-center gap-4">
        <p className="num font-display text-[54px] leading-none tracking-[-0.04em]">
          {me.pos}
          <span className="text-[24px] text-white/50">º</span>
        </p>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Sua posição · {m.label}
          </p>
          <p className="num text-[20px] font-bold">{amount(me.value, m)}</p>
          <span
            className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold"
            style={{ background: `${lg.color}30`, color: lg.color }}
          >
            Liga {lg.name} · Nv. {lg.level}
          </span>
        </div>
      </div>
      <div className="relative mt-4">
        {me.pos === 1 ? (
          <p className="flex items-center gap-2 text-[13.5px] text-white/80">
            <Crown className="h-4 w-4 text-[#e0b43a]" />
            {lead !== null && chaser
              ? `Você lidera com ${amount(lead, m)} de vantagem sobre ${chaser.displayName}.`
              : "Você lidera este ranking."}
          </p>
        ) : (
          rival &&
          gap !== null && (
            <>
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2 text-white/80">
                  <Swords className="h-4 w-4 shrink-0 text-[#ff7a4d]" />
                  <span className="truncate">
                    Faltam <b className="text-white">{amount(gap, m)}</b> para passar{" "}
                    {rival.displayName}
                  </span>
                </span>
                <UserAvatar profile={rival} size="sm" />
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/12">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(6, Math.round(toward * 100))}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-[#d7f53a]"
                />
              </div>
            </>
          )
        )}
        {lg.next && (
          <p className="mt-3 text-[12px] text-white/50">
            Próxima liga: <span style={{ color: lg.next.color }}>{lg.next.name}</span> no nível{" "}
            {lg.next.min}.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Pedestal({
  row,
  place,
  me,
  m,
  reduce,
}: {
  row: RankingRow;
  place: 1 | 2 | 3;
  me: boolean;
  m: (typeof METRICS)[number];
  reduce: boolean;
}) {
  const s = PODIUM[place];
  const order = place === 1 ? 0.35 : place === 2 ? 0.18 : 0;
  const lg = league(row.xp);
  return (
    <div className="flex min-w-0 flex-col items-center">
      <motion.div
        initial={reduce ? false : { y: -30, opacity: 0, scale: 0.7 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: order + 0.35, type: "spring", stiffness: 320, damping: 18 }}
        className="relative flex flex-col items-center"
      >
        {place === 1 && (
          <motion.span
            aria-hidden
            animate={reduce ? undefined : { y: [0, -4, 0], rotate: [-6, 6, -6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-7 text-[#e0b43a]"
          >
            <Crown className="h-7 w-7 fill-current" />
          </motion.span>
        )}
        <span className="rounded-full p-[3px]" style={{ background: s.color, boxShadow: s.glow }}>
          <span className="block rounded-full ring-2 ring-card">
            <UserAvatar profile={row} size={place === 1 ? "lg" : "md"} />
          </span>
        </span>
        <p
          className={`mt-2 max-w-full truncate px-1 text-[13.5px] font-bold ${me ? "text-gold" : ""}`}
        >
          {me ? "Você" : row.displayName}
        </p>
        <p className="text-[11px] font-semibold" style={{ color: lg.color }}>
          {lg.name}
        </p>
      </motion.div>
      <motion.div
        initial={reduce ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: order, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: s.h, transformOrigin: "bottom" }}
        className="relative mt-2 flex w-full flex-col items-center justify-start overflow-hidden rounded-t-[18px] pt-2.5"
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${s.color}, color-mix(in srgb, ${s.color} 45%, var(--card)))`,
          }}
        />
        <span className="num relative font-display text-[30px] leading-none text-[#141414]">
          {place}
        </span>
        <span className="num relative mt-1.5 text-[13px] font-bold text-[#141414]/80">
          <CountUp value={row.value} />
        </span>
        <span className="relative text-[10px] font-semibold text-[#141414]/60">{m.unit}</span>
      </motion.div>
    </div>
  );
}

function PodiumSkeleton() {
  return (
    <div className="mx-4 mt-10 grid grid-cols-3 items-end gap-2.5">
      {[96, 128, 78].map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <span className="h-14 w-14 animate-pulse rounded-full bg-surface-2" />
          <span
            className="w-full animate-pulse rounded-t-[18px] bg-surface-2"
            style={{ height: h }}
          />
        </div>
      ))}
    </div>
  );
}

function Message({ text, lumi }: { text: string; lumi?: boolean }) {
  return (
    <div className="mx-4 mt-8 flex flex-col items-center gap-3 rounded-[28px] bg-surface-2 p-8 text-center">
      {lumi && <Lumi pose="idle" size={72} shadow={false} />}
      <p className="text-[14px] text-muted-foreground">{text}</p>
    </div>
  );
}
