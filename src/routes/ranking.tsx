import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Medal, Trophy } from "lucide-react";
import { subscribeRanking, type RankingMetric, type RankingRow } from "@/lib/ranking";
import { subscribeAuth } from "@/lib/firebase";
import { getLevelInfo } from "@/lib/achievements";
import { UserAvatar } from "@/components/user-avatar";
import { LumiMascot } from "@/components/lumi-mascot";
import type { User } from "firebase/auth";

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

const METRICS: { id: RankingMetric; label: string; plural: string }[] = [
  { id: "xp", label: "XP geral", plural: "XP" },
  { id: "weeklyXp", label: "Esta semana", plural: "XP na semana" },
  { id: "monthlyXp", label: "Este mês", plural: "XP no mês" },
  { id: "currentStreak", label: "Sequência", plural: "dias" },
  { id: "chaptersRead", label: "Capítulos", plural: "capítulos" },
  { id: "monthlyChaptersRead", label: "Capítulos do mês", plural: "capítulos" },
  { id: "booksCompleted", label: "Concluídos", plural: "livros" },
];

const PODIUM_STYLE: Record<number, { ring: string; badge: string; medal: string; lift: string }> = {
  1: {
    ring: "ring-2 ring-gold shadow-[0_0_24px_-4px_var(--gold)]",
    badge: "bg-gold text-primary-foreground",
    medal: "text-gold",
    lift: "sm:-translate-y-3",
  },
  2: {
    ring: "ring-2 ring-[#C9CDD6]",
    badge: "bg-[#C9CDD6] text-[#1A1A1A]",
    medal: "text-[#C9CDD6]",
    lift: "",
  },
  3: {
    ring: "ring-2 ring-[#C9834B]",
    badge: "bg-[#C9834B] text-[#1A1A1A]",
    medal: "text-[#C9834B]",
    lift: "",
  },
};

function formatted(value: number, unit: string) {
  return `${value.toLocaleString("pt-BR")} ${unit}`;
}

function PodiumCard({
  row,
  place,
  isMe,
  unit,
}: {
  row: RankingRow;
  place: 1 | 2 | 3;
  isMe: boolean;
  unit: string;
}) {
  const style = PODIUM_STYLE[place];
  return (
    <div
      className={`glass-plate flex flex-col items-center rounded-2xl p-5 text-center transition-transform ${style.lift}`}
    >
      <div className={`relative rounded-full ${style.ring}`}>
        <UserAvatar profile={row} size={place === 1 ? "lg" : "md"} />
        <span
          className={`absolute -bottom-1.5 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full text-xs font-bold ${style.badge}`}
        >
          {place}
        </span>
      </div>
      <Medal className={`mt-4 h-4 w-4 ${style.medal}`} />
      <p className={`mt-1 truncate text-sm font-medium ${isMe ? "text-gold" : "text-foreground"}`}>
        {isMe ? "Você" : row.displayName}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">Nv. {getLevelInfo(row.xp).level}</p>
      <p className="mt-1.5 text-sm font-semibold tabular-nums">{formatted(row.value, unit)}</p>
    </div>
  );
}

function RankingPage() {
  const [metric, setMetric] = useState<RankingMetric>("xp");
  const [rows, setRows] = useState<RankingRow[] | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const currentMetric = METRICS.find((item) => item.id === metric)!;

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    setRows(undefined);
    return subscribeRanking(50, setRows, metric);
  }, [metric]);
  useEffect(() => {
    const timer = setTimeout(
      () => setRows((current) => (current === undefined ? null : current)),
      10000,
    );
    return () => clearTimeout(timer);
  }, [metric]);

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  const myRow = rows?.find((row) => !user?.isAnonymous && row.uid === user?.uid);
  const nextRow = myRow && rows ? rows[myRow.pos - 2] : undefined;
  const distance = myRow && nextRow ? Math.max(0, nextRow.value - myRow.value) : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
        <Trophy className="h-4 w-4" /> Ranking
      </div>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Leitores em movimento</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Os rankings mostram os dados registrados nas contas. Cada aba usa uma métrica diferente, sem
        transformar livros de catálogo em leitura concluída.
      </p>
      <div className="mt-7 flex gap-2 overflow-x-auto pb-1">
        {METRICS.map((item) => (
          <button
            key={item.id}
            onClick={() => setMetric(item.id)}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-sm transition ${item.id === metric ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-gold/45 hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {myRow && (
        <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/5 px-5 py-4 text-sm">
          <p className="font-medium">Você está em {myRow.pos}º neste ranking.</p>
          <p className="mt-1 text-muted-foreground">
            {distance === null
              ? "Você está no topo."
              : distance === 0
                ? "Empate técnico com a próxima posição."
                : `Faltam ${formatted(distance, currentMetric.plural)} para a próxima posição.`}
          </p>
        </div>
      )}
      {rows === undefined ? (
        <Loading />
      ) : rows === null ? (
        <Message text="Não foi possível carregar o ranking agora." />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="mt-10 grid grid-cols-3 items-end gap-3 sm:gap-4">
            {podium[1] && (
              <PodiumCard
                row={podium[1]}
                place={2}
                isMe={!!user && !user.isAnonymous && podium[1].uid === user.uid}
                unit={currentMetric.plural}
              />
            )}
            {podium[0] && (
              <PodiumCard
                row={podium[0]}
                place={1}
                isMe={!!user && !user.isAnonymous && podium[0].uid === user.uid}
                unit={currentMetric.plural}
              />
            )}
            {podium[2] && (
              <PodiumCard
                row={podium[2]}
                place={3}
                isMe={!!user && !user.isAnonymous && podium[2].uid === user.uid}
                unit={currentMetric.plural}
              />
            )}
          </div>
          {rest.length > 0 && (
            <div className="mt-6 glass-plate rounded-3xl p-4 sm:p-7">
              <ul className="divide-y divide-border/60">
                {rest.map((row) => {
                  const me = !!user && !user.isAnonymous && row.uid === user.uid;
                  return (
                    <li
                      key={row.uid}
                      className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 rounded-xl px-2 py-3.5 ${me ? "bg-gold/8" : ""}`}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full text-sm font-medium ${me ? "bg-gold text-primary-foreground" : "bg-secondary text-foreground/70"}`}
                      >
                        {row.pos}
                      </span>
                      <UserAvatar profile={row} size="sm" />
                      <span className={`truncate ${me ? "font-medium text-gold" : ""}`}>
                        {me ? "Você" : row.displayName}
                        <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Nv. {getLevelInfo(row.xp).level}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatted(row.value, currentMetric.plural)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Loading() {
  return <Message text="Carregando ranking…" />;
}
function Message({ text }: { text: string }) {
  return (
    <div className="mt-10 glass-plate rounded-3xl p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
function Empty() {
  return (
    <div className="mt-10 glass-plate flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
      <LumiMascot size={56} blink={false} />
      <p className="text-sm text-muted-foreground">Ainda não há dados suficientes nesta métrica.</p>
    </div>
  );
}
