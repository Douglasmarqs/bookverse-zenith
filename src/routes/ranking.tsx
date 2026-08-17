import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Medal } from "lucide-react";
import { subscribeRanking, type RankingRow } from "@/lib/ranking";
import { subscribeAuth } from "@/lib/firebase";
import { getLevelInfo } from "@/lib/achievements";
import { UserAvatar } from "@/components/user-avatar";
import { LumiMascot } from "@/components/lumi-mascot";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — BookVerse" },
      { name: "description", content: "Os leitores com mais XP no BookVerse." },
    ],
  }),
  component: RankingPage,
});

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

function PodiumCard({ row, place, isMe }: { row: RankingRow; place: 1 | 2 | 3; isMe: boolean }) {
  const style = PODIUM_STYLE[place];
  const level = getLevelInfo(row.xp).level;
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
      <p className="mt-0.5 text-xs text-muted-foreground">Nv. {level}</p>
      <p className="mt-1.5 text-sm font-semibold tabular-nums">
        {row.xp.toLocaleString("pt-BR")} XP
      </p>
    </div>
  );
}

function RankingPage() {
  const [rows, setRows] = useState<RankingRow[] | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => subscribeRanking(50, setRows), []);

  // Safety net: if Firestore's realtime listener never calls back at all
  // (fully offline/blocked, no cache), stop showing "Carregando…" forever.
  useEffect(() => {
    const timer = setTimeout(() => setRows((r) => (r === undefined ? null : r)), 10000);
    return () => clearTimeout(timer);
  }, []);

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
        <Trophy className="h-4 w-4" /> Ranking
      </div>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Top leitores</h1>
      <p className="mt-3 text-muted-foreground">
        XP é ganho lendo capítulos, concluindo livros e adicionando novos títulos à sua biblioteca.
      </p>

      {rows === undefined ? (
        <div className="mt-10 glass-plate rounded-3xl p-10 text-center text-sm text-muted-foreground">
          Carregando ranking…
        </div>
      ) : rows === null ? (
        <div className="mt-10 glass-plate rounded-3xl p-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar o ranking agora.
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 glass-plate flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
          <LumiMascot size={56} blink={false} />
          <p className="text-sm text-muted-foreground">
            Ainda ninguém pontuou — seja o primeiro a ler e aparecer aqui!
          </p>
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="mt-10 grid grid-cols-3 items-end gap-3 sm:gap-4">
              {podium[1] && (
                <PodiumCard
                  row={podium[1]}
                  place={2}
                  isMe={!!user && !user.isAnonymous && podium[1].uid === user.uid}
                />
              )}
              {podium[0] && (
                <PodiumCard
                  row={podium[0]}
                  place={1}
                  isMe={!!user && !user.isAnonymous && podium[0].uid === user.uid}
                />
              )}
              {podium[2] && (
                <PodiumCard
                  row={podium[2]}
                  place={3}
                  isMe={!!user && !user.isAnonymous && podium[2].uid === user.uid}
                />
              )}
            </div>
          )}

          {rest.length > 0 && (
            <div className="mt-6 glass-plate rounded-3xl p-4 sm:p-7">
              <ul className="divide-y divide-border/60">
                {rest.map((r) => {
                  const me = !!user && !user.isAnonymous && r.uid === user.uid;
                  const level = getLevelInfo(r.xp).level;
                  return (
                    <li
                      key={r.uid}
                      className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 rounded-xl px-2 py-3.5 transition-colors ${
                        me
                          ? "bg-gold/8 text-foreground"
                          : "text-foreground/85 hover:bg-secondary/40"
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full text-sm font-medium ${
                          me ? "bg-gold text-primary-foreground" : "bg-secondary text-foreground/70"
                        }`}
                      >
                        {r.pos}
                      </span>
                      <UserAvatar profile={r} size="sm" />
                      <span className={`truncate ${me ? "font-medium" : ""}`}>
                        {me ? "Você" : r.displayName}
                        <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Nv. {level}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {r.xp.toLocaleString("pt-BR")} XP
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
