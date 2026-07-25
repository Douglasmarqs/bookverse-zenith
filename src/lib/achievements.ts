/**
 * Achievements, levels, and weekly missions — all computed reactively from
 * real profile/library stats (nothing here is "stored as unlocked"; it's
 * recalculated every time from `xp`, `booksCompleted`, `chaptersRead`,
 * `currentStreak`, and library size). That keeps it simple and impossible
 * to get out of sync with the underlying data.
 */
import type { UserProfile } from "./user-profile";

export interface AchievementStats {
  booksCompleted: number;
  chaptersRead: number;
  currentStreak: number;
  longestStreak: number;
  libraryCount: number;
}

export type AchievementCategory = "leitura" | "capitulos" | "sequencia" | "biblioteca";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  threshold: number;
  metric: (s: AchievementStats) => number;
  xpReward: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Leitura — books completed
  {
    id: "books-1",
    title: "Primeira página",
    description: "Termine seu primeiro livro",
    category: "leitura",
    threshold: 1,
    metric: (s) => s.booksCompleted,
    xpReward: 20,
  },
  {
    id: "books-5",
    title: "Leitor assíduo",
    description: "Termine 5 livros",
    category: "leitura",
    threshold: 5,
    metric: (s) => s.booksCompleted,
    xpReward: 50,
  },
  {
    id: "books-10",
    title: "Bibliófilo",
    description: "Termine 10 livros",
    category: "leitura",
    threshold: 10,
    metric: (s) => s.booksCompleted,
    xpReward: 100,
  },
  {
    id: "books-25",
    title: "Devorador de livros",
    description: "Termine 25 livros",
    category: "leitura",
    threshold: 25,
    metric: (s) => s.booksCompleted,
    xpReward: 250,
  },
  {
    id: "books-50",
    title: "Lenda literária",
    description: "Termine 50 livros",
    category: "leitura",
    threshold: 50,
    metric: (s) => s.booksCompleted,
    xpReward: 500,
  },

  // Capítulos — proxy for "pages read"
  {
    id: "chapters-10",
    title: "Começando a jornada",
    description: "Leia 10 capítulos",
    category: "capitulos",
    threshold: 10,
    metric: (s) => s.chaptersRead,
    xpReward: 15,
  },
  {
    id: "chapters-50",
    title: "Ritmo de leitura",
    description: "Leia 50 capítulos",
    category: "capitulos",
    threshold: 50,
    metric: (s) => s.chaptersRead,
    xpReward: 40,
  },
  {
    id: "chapters-150",
    title: "Maratonista",
    description: "Leia 150 capítulos",
    category: "capitulos",
    threshold: 150,
    metric: (s) => s.chaptersRead,
    xpReward: 100,
  },
  {
    id: "chapters-400",
    title: "Incansável",
    description: "Leia 400 capítulos",
    category: "capitulos",
    threshold: 400,
    metric: (s) => s.chaptersRead,
    xpReward: 250,
  },

  // Sequência — daily streak
  {
    id: "streak-3",
    title: "Hábito nascendo",
    description: "3 dias seguidos lendo",
    category: "sequencia",
    threshold: 3,
    metric: (s) => s.longestStreak,
    xpReward: 20,
  },
  {
    id: "streak-7",
    title: "Semana completa",
    description: "7 dias seguidos lendo",
    category: "sequencia",
    threshold: 7,
    metric: (s) => s.longestStreak,
    xpReward: 60,
  },
  {
    id: "streak-14",
    title: "Duas semanas",
    description: "14 dias seguidos lendo",
    category: "sequencia",
    threshold: 14,
    metric: (s) => s.longestStreak,
    xpReward: 120,
  },
  {
    id: "streak-30",
    title: "Um mês de leitura",
    description: "30 dias seguidos lendo",
    category: "sequencia",
    threshold: 30,
    metric: (s) => s.longestStreak,
    xpReward: 300,
  },

  // Biblioteca — collection size
  {
    id: "library-5",
    title: "Primeira estante",
    description: "Salve 5 livros na biblioteca",
    category: "biblioteca",
    threshold: 5,
    metric: (s) => s.libraryCount,
    xpReward: 20,
  },
  {
    id: "library-15",
    title: "Colecionador",
    description: "Salve 15 livros na biblioteca",
    category: "biblioteca",
    threshold: 15,
    metric: (s) => s.libraryCount,
    xpReward: 60,
  },
  {
    id: "library-30",
    title: "Curador",
    description: "Salve 30 livros na biblioteca",
    category: "biblioteca",
    threshold: 30,
    metric: (s) => s.libraryCount,
    xpReward: 150,
  },
];

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  leitura: "Leitura",
  capitulos: "Capítulos",
  sequencia: "Sequência",
  biblioteca: "Biblioteca",
};

export function isUnlocked(a: Achievement, stats: AchievementStats): boolean {
  return a.metric(stats) >= a.threshold;
}

/** How close to unlocking, 0–1 (capped at 1 once unlocked). */
export function achievementProgress(a: Achievement, stats: AchievementStats): number {
  return Math.min(1, a.metric(stats) / a.threshold);
}

// --- Levels -----------------------------------------------------------
// Cumulative XP needed to reach level L (L>=1): 50 * L * (L - 1).
// L1 = 0, L2 = 100, L3 = 300, L4 = 600, L5 = 1000, L6 = 1500 ...
// (Each level asks for progressively more, RPG-style.)

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number; // 0-1
}

function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function getLevelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - base,
    xpForNextLevel: next - base,
    progress: next > base ? (xp - base) / (next - base) : 1,
  };
}

// --- Weekly missions ----------------------------------------------------

export interface Mission {
  id: string;
  title: string;
  threshold: number;
  metric: (p: UserProfile) => number;
  xpReward: number;
}

export const WEEKLY_MISSIONS: Mission[] = [
  {
    id: "weekly-chapters",
    title: "Leia 5 capítulos esta semana",
    threshold: 5,
    metric: (p) => p.weeklyChaptersRead ?? 0,
    xpReward: 30,
  },
  {
    id: "weekly-xp",
    title: "Ganhe 150 XP esta semana",
    threshold: 150,
    metric: (p) => p.weeklyXp ?? 0,
    xpReward: 40,
  },
  {
    id: "weekly-books",
    title: "Adicione um livro novo esta semana",
    threshold: 1,
    metric: (p) => p.weeklyBooksAdded ?? 0,
    xpReward: 20,
  },
];
