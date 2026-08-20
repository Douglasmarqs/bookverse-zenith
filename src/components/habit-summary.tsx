/**
 * Resumo de hábito de leitura para a Home: sequência de dias, nível/XP e a
 * meta anual. Assina os próprios dados (perfil + biblioteca + meta) para a
 * Home não precisar carregar tudo isso quando o leitor não está logado.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Target, Trophy } from "lucide-react";

import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { subscribeReadingGoal, computeGoalProgress, currentYear } from "@/lib/goals";
import { getLevelInfo } from "@/lib/achievements";

export function HabitSummary({ uid }: { uid: string }) {
  const year = currentYear();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => {
    const unsubs = [
      subscribeUserProfile(uid, setProfile),
      subscribeLibrary(uid, setEntries),
      subscribeReadingGoal(uid, year, (g) => setTarget(g?.books ?? null)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, year]);

  const level = useMemo(() => getLevelInfo(profile?.xp ?? 0), [profile?.xp]);
  const goal = useMemo(
    () => computeGoalProgress(entries, target ?? 0),
    [entries, target],
  );

  const streak = profile?.currentStreak ?? 0;
  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return {
        label: ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()]!,
        // Aproximação honesta: a sequência atual cobre os últimos N dias.
        active: 6 - i < streak,
      };
    });
  }, [streak]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Sequência */}
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Flame className="h-4 w-4 text-gold" />
          Sequência
        </div>
        <p className="mt-4 font-display text-4xl font-medium">
          {streak}
          <span className="ml-2 text-base text-muted-foreground">
            {streak === 1 ? "dia" : "dias"}
          </span>
        </p>
        <div className="mt-5 flex items-center gap-2">
          {weekDays.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`h-8 w-full rounded-md ${d.active ? "bg-gold/80" : "bg-secondary"}`}
              />
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Recorde: {profile?.longestStreak ?? 0} dias
        </p>
      </div>

      {/* Meta anual */}
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Target className="h-4 w-4 text-gold" />
          Meta {year}
        </div>
        {target ? (
          <>
            <p className="mt-4 font-display text-4xl font-medium">
              {goal.completed}
              <span className="ml-2 text-base text-muted-foreground">de {goal.target}</span>
            </p>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-700"
                style={{ width: `${goal.percent}%` }}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {goal.remaining === 0
                ? "Meta batida. Que tal aumentar?"
                : `Faltam ${goal.remaining} · ${goal.perMonthNeeded}/mês para chegar lá`}
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Defina quantos livros você quer concluir em {year} e acompanhe o ritmo mês a mês.
            </p>
            <Link
              to="/metas"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Criar minha meta <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>

      {/* Nível */}
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Trophy className="h-4 w-4 text-gold" />
          Nível
        </div>
        <p className="mt-4 font-display text-4xl font-medium">
          {level.level}
          <span className="ml-2 text-base text-muted-foreground">{profile?.xp ?? 0} XP</span>
        </p>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-700"
            style={{ width: `${Math.round(level.progress * 100)}%` }}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {level.xpForNextLevel - level.xpIntoLevel} XP para o nível {level.level + 1}
        </p>
      </div>
    </div>
  );
}
