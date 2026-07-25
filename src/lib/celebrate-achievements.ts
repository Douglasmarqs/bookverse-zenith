import { toast } from "sonner";
import { ACHIEVEMENTS, isUnlocked, type AchievementStats } from "./achievements";

const STORAGE_KEY = "bookverse:achievements-seen";

/**
 * Compares currently-unlocked achievements against what's already been
 * celebrated on this device (localStorage only — the actual unlocked
 * state is always derived live from Firestore stats, this is purely "have
 * I shown the toast for this one yet"). Call this after any action that
 * could cross a threshold: finishing a chapter/book, adding to the
 * library, or just landing on a page that has fresh stats.
 */
export function celebrateNewAchievements(stats: AchievementStats): void {
  if (typeof window === "undefined") return;
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    seen = [];
  }

  const unlockedIds = ACHIEVEMENTS.filter((a) => isUnlocked(a, stats)).map((a) => a.id);
  const newlyUnlocked = unlockedIds.filter((id) => !seen.includes(id));
  if (newlyUnlocked.length === 0) return;

  for (const id of newlyUnlocked) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) continue;
    toast.success(`Conquista desbloqueada: ${a.title}`, {
      description: `${a.description} · +${a.xpReward} XP`,
    });
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedIds));
  } catch {
    // storage unavailable — not critical, worst case it celebrates again later
  }
}
