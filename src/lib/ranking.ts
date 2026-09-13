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

export type RankingMetric = "xp" | "weeklyXp" | "currentStreak" | "chaptersRead" | "booksCompleted";

export type RankingRow = Pick<UserProfile, "uid" | "displayName" | "photoURL" | "xp"> & {
  pos: number;
  value: number;
};

const METRIC_FIELD: Record<RankingMetric, string> = {
  xp: "xp",
  weeklyXp: "weeklyXp",
  currentStreak: "currentStreak",
  chaptersRead: "chaptersRead",
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
  const q = query(collection(fb.db, "users"), orderBy(field, "desc"), limit(n));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d, i) => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: data.displayName ?? "Leitor",
          photoURL: data.photoURL ?? null,
          xp: data.xp ?? 0,
          value: Number(data[field] ?? 0),
          pos: i + 1,
        } satisfies RankingRow;
      });
      cb(rows);
    },
    (err) => {
      console.warn("[ranking] subscribe failed", err);
      cb(null);
    },
  );
}
