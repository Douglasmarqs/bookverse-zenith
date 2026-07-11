import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { subscribeRanking, type RankingRow } from "@/lib/ranking";
import { subscribeAuth } from "@/lib/firebase";
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

function RankingPage() {
  const [rows, setRows] = useState<RankingRow[] | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => subscribeRanking(50, setRows), []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
        <Trophy className="h-4 w-4" /> Ranking
      </div>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Top leitores</h1>
      <p className="mt-3 text-muted-foreground">
        XP é ganho lendo capítulos, concluindo livros e adicionando novos títulos à sua biblioteca.
      </p>

      <div className="mt-10 glass-plate rounded-3xl p-4 sm:p-7">
        {rows === undefined ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando ranking…</div>
        ) : rows === null ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Não foi possível carregar o ranking agora.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Ainda ninguém pontuou — seja o primeiro a ler e aparecer aqui!
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => {
              const me = user && !user.isAnonymous && r.uid === user.uid;
              return (
                <li
                  key={r.uid}
                  className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 py-3.5 ${
                    me ? "text-foreground" : "text-foreground/85"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-sm font-medium ${
                      me ? "bg-gold text-primary-foreground" : "bg-secondary text-foreground/70"
                    }`}
                  >
                    {r.pos}
                  </span>
                  {r.photoURL ? (
                    <img src={r.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-medium text-foreground/70">
                      {r.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={`truncate ${me ? "font-medium" : ""}`}>
                    {me ? "Você" : r.displayName}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {r.xp.toLocaleString("pt-BR")} XP
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
