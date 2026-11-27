/**
 * Real-time ranking — top readers by XP, read from the same `users`
 * collection that `user-profile.ts` writes to.
 */
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import type { UserProfile } from "./user-profile";

export type RankingMetric =
  | "xp"
  | "weeklyXp"
  | "monthlyXp"
  | "currentStreak"
  | "chaptersRead"
  | "monthlyChaptersRead"
  | "booksCompleted";

export type RankingRow = Pick<UserProfile, "uid" | "displayName" | "photoURL" | "xp"> & {
  pos: number;
  value: number;
  currentStreak?: number;
  booksCompleted?: number;
};

/** The date in São Paulo (where the server counts weeks), YYYY-MM-DD. */
export function saoPauloDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const v = (t: "year" | "month" | "day") => parts.find((p) => p.type === t)?.value ?? "01";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

export function currentWeekStart(date = new Date()): string {
  const d = new Date(`${saoPauloDateKey(date)}T12:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

/** When the weekly (next Monday 00:00 in São Paulo) or monthly board resets. */
export function periodEnd(kind: "week" | "month", date = new Date()): Date {
  const key = kind === "week" ? currentWeekStart(date) : `${saoPauloDateKey(date).slice(0, 7)}-01`;
  const d = new Date(`${key}T03:00:00Z`); // 00:00 in São Paulo (UTC−3)
  if (kind === "week") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

const WEEKLY = new Set<RankingMetric>(["weeklyXp"]);
const MONTHLY = new Set<RankingMetric>(["monthlyXp", "monthlyChaptersRead"]);

const METRIC_FIELD: Record<RankingMetric, string> = {
  xp: "xp",
  weeklyXp: "weeklyXp",
  monthlyXp: "monthlyXp",
  currentStreak: "currentStreak",
  chaptersRead: "chaptersRead",
  monthlyChaptersRead: "monthlyChaptersRead",
  booksCompleted: "booksCompleted",
};

/**
 * Subscribes to the top N users by XP. Calls back with `null` while
 * Firebase isn't configured (e.g. missing API key) so callers can show a
 * graceful empty state instead of crashing.
 */
export function subscribeRanking(
  n: number,
  cb: (rows: RankingRow[] | null) => void,
  metric: RankingMetric = "xp",
): Unsubscribe {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }

  const field = METRIC_FIELD[metric];
  const periodic = WEEKLY.has(metric) || MONTHLY.has(metric);
  // Weekly/monthly counters only reset when that reader earns XP again, so a
  // big number from an earlier week can still be stored: read extra rows and
  // drop the stale ones.
  const q = query(
    collection(fb.db, "users"),
    orderBy(field, "desc"),
    limit(periodic ? Math.min(100, n * 3) : n),
  );
  return onSnapshot(
    q,
    (snap) => {
      const week = currentWeekStart();
      const month = `${saoPauloDateKey().slice(0, 7)}-01`;
      const rows = snap.docs
        .map((d) => {
          const data = d.data();
          const stale =
            (WEEKLY.has(metric) && data.weekStart !== week) ||
            (MONTHLY.has(metric) && data.monthStart !== month);
          return {
            uid: d.id,
            displayName: data.displayName ?? "Leitor",
            photoURL: data.photoURL ?? null,
            xp: data.xp ?? 0,
            value: stale ? 0 : Number(data[field] ?? 0),
            pos: 0,
            currentStreak: Number(data.currentStreak ?? 0),
            booksCompleted: Number(data.booksCompleted ?? 0),
          } satisfies RankingRow;
        })
        .filter((r) => !periodic || r.value > 0)
        .sort((a, b) => b.value - a.value || b.xp - a.xp)
        .slice(0, n)
        .map((r, i) => ({ ...r, pos: i + 1 }));
      cb(rows);
    },
    (err) => {
      console.warn("[ranking] subscribe failed", err);
      cb(null);
    },
  );
}
