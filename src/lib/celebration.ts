/**
 * Big moments (a goal met, an achievement unlocked) get the full-screen
 * "Lumi comemorando" card (mockup M5) instead of a small toast.
 */
import { useSyncExternalStore } from "react";

export interface Celebration {
  eyebrow: string;
  title: string;
  body?: string;
  share?: string;
}

let current: Celebration | null = null;
const listeners = new Set<() => void>();

export function celebrate(c: Celebration) {
  current = c;
  listeners.forEach((l) => l());
}

export function dismissCelebration() {
  current = null;
  listeners.forEach((l) => l());
}

export function useCelebration(): Celebration | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => null,
  );
}
