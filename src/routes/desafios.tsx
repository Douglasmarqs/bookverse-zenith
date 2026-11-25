import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  BookCheck,
  Check,
  ChevronLeft,
  FileText,
  Flame,
  Library,
  Lock,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";

import { BookArt } from "@/components/book-art";
import {
  ACHIEVEMENTS,
  WEEKLY_MISSIONS,
  achievementProgress,
  getLevelInfo,
  isUnlocked,
  type AchievementCategory,
  type AchievementStats,
} from "@/lib/achievements";
import { celebrateNewAchievements } from "@/lib/celebrate-achievements";
import { READING_TRACKS } from "@/lib/editorial";
import { subscribeAuth } from "@/lib/firebase";
import { slugFor, subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { subscribeRanking, type RankingRow } from "@/lib/ranking";
import { subscribeReadingProgress, type StoredReadingProgress } from "@/lib/reader-store";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";

export const Route = createFileRoute("/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — BookVerse" },
      {
        name: "description",
        content: "Desafio do mês, conquistas, missões da semana e o clube de leitores.",
      },
    ],
  }),
  component: DesafiosPage,
});

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** One public-domain classic suggested for each month's challenge. */
const MONTH_PICK: { title: string; author: string }[] = [
  { title: "Dom Casmurro", author: "Machado de Assis" },
  { title: "Orgulho e Preconceito", author: "Jane Austen" },
  { title: "O Alienista", author: "Machado de Assis" },
  { title: "Frankenstein", author: "Mary Shelley" },
  { title: "Iracema", author: "José de Alencar" },
  { title: "Alice no País das Maravilhas", author: "Lewis Carroll" },
  { title: "A Ilha do Tesouro", author: "Robert Louis Stevenson" },
  { title: "O Cortiço", author: "Aluísio Azevedo" },
  { title: "Drácula", author: "Bram Stoker" },
  { title: "O Médico e o Monstro", author: "Robert Louis Stevenson" },
  { title: "Dom Quixote", author: "Miguel de Cervantes" },
  { title: "Um Conto de Natal", author: "Charles Dickens" },
];

const CAT: Record<AchievementCategory, { icon: typeof Flame; bg: string; fg: string }> = {
  sequencia: { icon: Flame, bg: "var(--accent-soft)", fg: "#e0431a" },
  leitura: { icon: BookCheck, bg: "var(--mint)", fg: "#1f8a52" },
  capitulos: { icon: FileText, bg: "var(--lilac)", fg: "#5b4be0" },
  biblioteca: { icon: Library, bg: "var(--sky)", fg: "#2563c9" },
};

const AVATAR_BG = ["#6d5df6", "#17867a", "#e0431a", "#2563c9", "#c0264f", "#7a5a00"];

function ratio(p?: StoredReadingProgress): number {
  if (!p) return 0;
  return Math.min(
    1,
    p.overallRatio ??
      ((p.chapterIndex ?? 0) + (p.scrollRatio ?? 0)) / Math.max(1, p.chapterCount ?? 1),
  );
}

function DesafiosPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [progress, setProgress] = useState<StoredReadingProgress[]>([]);
  const [club, setClub] = useState<RankingRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => subscribeAuth(setUser), []);
  const signedIn = !!user && !user.isAnonymous;
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setProfile(null);
      setLibrary([]);
      setProgress([]);
      return;
    }
    const unsubs = [
      subscribeUserProfile(user.uid, setProfile),
      subscribeLibrary(user.uid, setLibrary),
      subscribeReadingProgress(user.uid, setProgress),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);
  useEffect(() => subscribeRanking(5, setClub, "weeklyXp"), []);

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

  useEffect(() => {
    if (!signedIn || !profile) return;
    celebrateNewAchievements(stats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, stats.booksCompleted, stats.chaptersRead, stats.longestStreak, stats.libraryCount]);

  // Monthly challenge: finish a classic this month. Shows the book you're
  // furthest along in this month, or the month's suggestion.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = monthEnd.getDate() - now.getDate();
  const challenge = useMemo(() => {
    const byReader = new Map(progress.map((p) => [p.bookId, p]));
    let best: { entry: LibraryEntry; r: number } | null = null;
    for (const e of library) {
      if (!e.readerId) continue;
      const p = byReader.get(e.readerId);
      if (!p || p.updatedAt < monthStart) continue;
      const r = e.status === "concluido" ? 1 : ratio(p);
      if (!best || r > best.r) best = { entry: e, r };
    }
    return best;
  }, [library, progress, monthStart]);
  const pick = MONTH_PICK[now.getMonth()]!;
  const heroBook = challenge
    ? { title: challenge.entry.title, author: challenge.entry.author, cover: challenge.entry.cover }
    : { ...pick, cover: null };
  const pct = Math.round((challenge?.r ?? 0) * 100);

  const unlocked = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats));
  const locked = ACHIEVEMENTS.filter((a) => !isUnlocked(a, stats));
  const ordered = [...unlocked, ...locked];
  const shown = showAll ? ordered : ordered.slice(0, 6);
  const level = getLevelInfo(profile?.xp ?? 0);

  async function share() {
    const text = signedIn
      ? `Estou no nível ${level.level} no BookVerse, com ${stats.currentStreak} dias seguidos de leitura e ${unlocked.length} conquistas. Bora ler junto?`
      : "Leia clássicos grátis comigo no BookVerse.";
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      if (navigator.share) await navigator.share({ title: "BookVerse", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Copiado para compartilhar.");
      }
    } catch {
      // cancelled
    }
  }

  const rise = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: d, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="mx-auto max-w-3xl pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-10">
      <header className="flex items-center justify-between px-3">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() =>
            window.history.length > 1 ? router.history.back() : router.navigate({ to: "/perfil" })
          }
          className="press grid h-[42px] w-[42px] place-items-center rounded-full"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="font-sans text-[17px] font-bold tracking-normal">Desafios</h1>
        <button
          type="button"
          aria-label="Compartilhar"
          onClick={() => void share()}
          className="press grid h-[42px] w-[42px] place-items-center rounded-full"
        >
          <Share2 className="h-[21px] w-[21px]" strokeWidth={2} />
        </button>
      </header>

      {/* Monthly challenge */}
      <motion.section
        {...rise(0)}
        className="relative mx-4 mt-3 min-h-[200px] overflow-hidden rounded-[30px] bg-[#141414] p-5 pr-[38%] text-white"
      >
        <span className="inline-flex rounded-full bg-[#d7f53a] px-3 py-1 text-[12.5px] font-bold text-[#131313]">
          Desafio de {MONTHS[now.getMonth()]}
        </span>
        <p className="mt-3 font-display text-[30px] leading-[1.02] tracking-[-0.03em]">
          Um clássico em 30 dias
        </p>
        <p className="mt-2 text-[13.5px] text-white/70">
          {challenge
            ? `${challenge.entry.title} · ${daysLeft === 0 ? "último dia" : `${daysLeft} dias restantes`}`
            : `Sugestão do mês: ${pick.title}`}
        </p>
        {challenge ? (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/15">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, pct)}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-[#d7f53a]"
              />
            </div>
            <span className="num text-[14px] font-semibold">{pct}%</span>
          </div>
        ) : (
          <Link
            to="/livro/$slug"
            params={{ slug: slugFor(pick.title, pick.author) || "livro" }}
            search={{ title: pick.title, author: pick.author }}
            className="press mt-4 inline-flex h-10 items-center rounded-full bg-white px-4 text-[13.5px] font-semibold text-[#131313]"
          >
            Aceitar o desafio
          </Link>
        )}
        <div className="pointer-events-none absolute -right-4 top-6 w-[42%] max-w-[170px] rotate-[10deg]">
          <BookArt title={heroBook.title} author={heroBook.author} cover={heroBook.cover} lift />
        </div>
      </motion.section>

      {/* Achievements */}
      <motion.section {...rise(0.06)}>
        <div className="mx-[22px] mb-3 mt-7 flex items-baseline justify-between">
          <h2 className="text-[24px]">Conquistas</h2>
          <span className="num text-[14px] font-semibold text-muted-foreground">
            {unlocked.length} de {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5 px-4 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((a, i) => {
            const on = isUnlocked(a, stats);
            const c = CAT[a.category];
            const Icon = c.icon;
            const p = achievementProgress(a, stats);
            return (
              <motion.div
                key={a.id}
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: Math.min(i, 8) * 0.03 } }}
                title={`${a.title} — ${a.description}`}
                className={`flex flex-col items-center rounded-[24px] px-2 pb-3.5 pt-3.5 text-center ${
                  on ? "surface-card" : "bg-card/50 shadow-[inset_0_0_0_1px_var(--border)]"
                }`}
              >
                <span
                  className="grid h-[52px] w-[52px] place-items-center rounded-[16px]"
                  style={
                    on
                      ? { background: c.bg, color: c.fg }
                      : { background: "var(--surface-2)", color: "var(--faint)" }
                  }
                >
                  {on ? (
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  ) : (
                    <Lock className="h-5 w-5" strokeWidth={2} />
                  )}
                </span>
                <p
                  className={`mt-2.5 text-[13.5px] font-semibold leading-tight ${on ? "" : "text-faint"}`}
                >
                  {a.title}
                </p>
                {!on && signedIn && (
                  <div className="mt-2 h-[4px] w-3/4 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-gold/70"
                      style={{ width: `${Math.round(p * 100)}%` }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        {ordered.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mx-auto mt-3 block rounded-full px-4 py-2 text-[13.5px] font-semibold text-gold"
          >
            {showAll ? "Mostrar menos" : `Ver todas as ${ACHIEVEMENTS.length}`}
          </button>
        )}
        {!signedIn && (
          <p className="mx-[22px] mt-2 text-center text-[13px] text-muted-foreground">
            <Link to="/auth" search={{ redirect: "/desafios" }} className="font-semibold text-gold">
              Entre
            </Link>{" "}
            para desbloquear conquistas e entrar no clube.
          </p>
        )}
      </motion.section>

      {/* Weekly missions */}
      {signedIn && profile && (
        <motion.section {...rise(0.1)}>
          <div className="mx-[22px] mb-3 mt-7 flex items-baseline justify-between">
            <h2 className="text-[24px]">Missões da semana</h2>
            <span className="text-[12.5px] font-semibold text-faint">renova na segunda</span>
          </div>
          <ul className="surface-card mx-4 px-4">
            {WEEKLY_MISSIONS.map((m, i) => {
              const cur = m.metric(profile);
              const done = cur >= m.threshold;
              return (
                <li
                  key={m.id}
                  className={`flex items-center gap-3 py-3 ${i < WEEKLY_MISSIONS.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${done ? "bg-mint text-[#1f6b46]" : "bg-surface-2 text-faint"}`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : (
                      <span className="num text-[12px] font-bold">
                        {Math.min(cur, m.threshold)}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[14.5px] font-semibold ${done ? "text-muted-foreground line-through" : ""}`}
                    >
                      {m.title}
                    </p>
                    <div className="mt-1.5 h-[4px] overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${Math.round(Math.min(1, cur / m.threshold) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold text-gold">
                    +{m.xpReward} XP
                  </span>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      {/* Club */}
      <motion.section {...rise(0.14)}>
        <div className="mx-[22px] mb-3 mt-7 flex items-baseline justify-between">
          <h2 className="text-[24px]">Clube desta semana</h2>
          <Link to="/ranking" className="text-[14px] font-semibold text-muted-foreground">
            Ranking
          </Link>
        </div>
        <ul className="surface-card mx-4 px-4">
          {club === null ? (
            <li className="py-5 text-center text-[13.5px] text-muted-foreground">
              O clube aparece aqui quando a conexão voltar.
            </li>
          ) : club.length === 0 ? (
            <li className="py-5 text-center text-[13.5px] text-muted-foreground">
              Ninguém pontuou ainda nesta semana. Que tal ser o primeiro?
            </li>
          ) : (
            club.map((r, i) => {
              const me = r.uid === user?.uid;
              return (
                <li
                  key={r.uid}
                  className={`flex items-center gap-3.5 py-3 ${i < club.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="num w-5 text-center text-[16px] font-semibold text-faint">
                    {r.pos}
                  </span>
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[16px] font-bold text-white"
                    style={{
                      background: me
                        ? "linear-gradient(135deg,#ffb199,#ff4d1a)"
                        : AVATAR_BG[i % AVATAR_BG.length],
                    }}
                  >
                    {(me ? "V" : r.displayName.trim()[0] || "L").toUpperCase()}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[16px] font-semibold ${me ? "text-muted-foreground" : ""}`}
                  >
                    {me ? "Você" : r.displayName.split(" ")[0]}
                  </span>
                  <span className="num shrink-0 text-[14.5px] text-muted-foreground">
                    {r.value} XP
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </motion.section>

      {/* Themed tracks */}
      <motion.section {...rise(0.18)}>
        <h2 className="mx-[22px] mb-3 mt-7 text-[24px]">Trilhas temáticas</h2>
        <div className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto scroll-pl-4 px-4 pb-1">
          {READING_TRACKS.map((t) => {
            const done = Math.min(stats.booksCompleted, t.goal);
            return (
              <Link
                key={t.id}
                to="/descobrir"
                search={{ q: t.query }}
                className="surface-card press w-[240px] shrink-0 snap-start rounded-[24px] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold leading-snug">{t.title}</p>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-gold">
                    +{t.xp} XP
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] text-muted-foreground">
                  {t.description}
                </p>
                <div className="mt-3 h-[4px] overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${Math.round((done / Math.max(1, t.goal)) * 100)}%` }}
                  />
                </div>
                <p className="num mt-1.5 text-[12px] text-faint">
                  {done} de {t.goal} {t.goal === 1 ? "livro" : "livros"}
                </p>
              </Link>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
