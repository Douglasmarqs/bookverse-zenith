import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Flame,
  Lock,
  Check,
  BookCheck,
  FileText,
  Library,
  Target,
  Compass,
} from "lucide-react";
import { subscribeAuth } from "@/lib/firebase";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import {
  ACHIEVEMENTS,
  CATEGORY_LABEL,
  WEEKLY_MISSIONS,
  achievementProgress,
  getLevelInfo,
  isUnlocked,
  type AchievementCategory,
  type AchievementStats,
} from "@/lib/achievements";
import { celebrateNewAchievements } from "@/lib/celebrate-achievements";
import { READING_TRACKS } from "@/lib/editorial";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — BookVerse" },
      {
        name: "description",
        content: "Conquistas, sequência de leitura, missões semanais e nível.",
      },
    ],
  }),
  component: DesafiosPage,
});

const CATEGORY_ICON: Record<AchievementCategory, React.ComponentType<{ className?: string }>> = {
  leitura: BookCheck,
  capitulos: FileText,
  sequencia: Flame,
  biblioteca: Library,
};

function DesafiosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setProfile(null);
      setLibrary([]);
      return;
    }
    const unsubProfile = subscribeUserProfile(user.uid, setProfile);
    const unsubLibrary = subscribeLibrary(user.uid, setLibrary);
    return () => {
      unsubProfile();
      unsubLibrary();
    };
  }, [user]);

  const signedIn = !!user && !user.isAnonymous;
  const xp = profile?.xp ?? 0;
  const level = useMemo(() => getLevelInfo(xp), [xp]);

  const stats: AchievementStats = useMemo(
    () => ({
      booksCompleted: profile?.booksCompleted ?? 0,
      chaptersRead: profile?.chaptersRead ?? 0,
      currentStreak: profile?.currentStreak ?? 0,
      longestStreak: profile?.longestStreak ?? 0,
      libraryCount: library.length,
    }),
    [profile, library.length],
  );

  const unlockedCount = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).length;

  // Celebrate achievements the person hasn't seen unlocked yet on this
  // device. Purely a local "have I shown the confetti" note — the real
  // unlocked/locked state above is always computed live from Firestore.
  useEffect(() => {
    if (!signedIn || !profile) return;
    celebrateNewAchievements(stats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, stats.booksCompleted, stats.chaptersRead, stats.longestStreak, stats.libraryCount]);

  const categories = Object.keys(CATEGORY_LABEL) as AchievementCategory[];

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
        <Trophy className="h-4 w-4" /> Desafios
      </div>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">
        Metas que valem uma medalha
      </h1>

      {!signedIn ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-muted-foreground">
            Entre na sua conta para acompanhar seu progresso real.
          </p>
          <Link
            to="/auth"
            search={{ redirect: undefined }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Entrar
          </Link>
        </div>
      ) : (
        <>
          {/* Level + Streak */}
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Nível
                </span>
                <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[10px] font-medium text-gold">
                  {unlockedCount} de {ACHIEVEMENTS.length} conquistas
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="font-display text-5xl font-medium text-gold">{level.level}</span>
                <span className="text-sm text-muted-foreground">
                  {level.xpIntoLevel} / {level.xpForNextLevel} XP pro próximo nível
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all"
                  style={{ width: `${Math.round(level.progress * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{xp} XP no total</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Sequência de leitura
              </span>
              <div className="mt-4 flex items-center gap-3">
                <Flame
                  className={`h-9 w-9 ${stats.currentStreak > 0 ? "text-gold" : "text-muted-foreground"}`}
                  fill={stats.currentStreak > 0 ? "currentColor" : "none"}
                />
                <div>
                  <p className="font-display text-3xl font-medium">
                    {stats.currentStreak}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {stats.currentStreak === 1 ? "dia" : "dias"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recorde: {stats.longestStreak} {stats.longestStreak === 1 ? "dia" : "dias"}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {stats.currentStreak > 0
                  ? "Continue lendo hoje para manter sua sequência viva."
                  : "Leia algo hoje para começar uma nova sequência."}
              </p>
            </div>
          </div>

          {/* Weekly missions */}
          <div className="mt-10">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gold" />
              <h2 className="font-display text-xl font-medium">Missões da semana</h2>
              <span className="text-xs text-muted-foreground">· renova toda segunda-feira</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {WEEKLY_MISSIONS.map((m) => {
                const current = profile ? m.metric(profile) : 0;
                const progress = Math.min(1, current / m.threshold);
                const done = current >= m.threshold;
                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-5 transition-colors ${done ? "border-gold/40 bg-gold/5" : "border-border/60 bg-card/60 hover:border-gold/25"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base font-medium leading-snug">{m.title}</h3>
                      {done && <Check className="h-4 w-4 shrink-0 text-gold" />}
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Math.min(current, m.threshold)} de {m.threshold} · +{m.xpReward} XP
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trilhas temáticas */}
          <div className="mt-12">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-gold" />
              <h2 className="font-display text-xl font-medium">Trilhas temáticas</h2>
              <span className="text-xs text-muted-foreground">· desafios com tema</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {READING_TRACKS.map((t) => {
                const done = Math.min(stats.booksCompleted, t.goal);
                const progress = t.goal > 0 ? done / t.goal : 0;
                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-border/60 bg-card/40 p-5 transition-colors hover:border-gold/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-base font-medium leading-snug">{t.title}</h3>
                      <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                        +{t.xp} XP
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {t.description}
                    </p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {done} de {t.goal} {t.goal === 1 ? "livro" : "livros"}
                      </p>
                      <Link
                        to="/descobrir"
                        search={{ q: t.query, categoria: undefined }}
                        className="text-xs font-medium text-gold hover:underline"
                      >
                        Ver livros →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Achievements */}
          <div className="mt-12">
            <h2 className="font-display text-xl font-medium">Conquistas</h2>

            {categories.map((cat) => {
              const items = ACHIEVEMENTS.filter((a) => a.category === cat);
              const Icon = CATEGORY_ICON[cat];
              return (
                <div key={cat} className="mt-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" /> {CATEGORY_LABEL[cat]}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((a) => {
                      const unlocked = isUnlocked(a, stats);
                      const progress = achievementProgress(a, stats);
                      return (
                        <div
                          key={a.id}
                          className={`rounded-2xl border p-4 text-center transition-all hover:-translate-y-0.5 ${
                            unlocked
                              ? "border-gold/40 bg-gold/5 hover:shadow-[0_8px_24px_-8px_var(--gold)]"
                              : "border-border/60 bg-card/30 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <div
                            className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${
                              unlocked
                                ? "bg-gold/15 text-gold"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                          </div>
                          <p className="mt-3 font-display text-sm font-medium leading-snug">
                            {a.title}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{a.description}</p>
                          {!unlocked && (
                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-gold/60"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
