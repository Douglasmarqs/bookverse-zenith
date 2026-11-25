/**
 * Daily reading ritual — minutes of *active* reading per local day.
 *
 * The reader adds time only while the page is visible and the reader has
 * interacted recently, so leaving a book open on the table does not count.
 * Days live in localStorage (instant, offline) and are merged into
 * users/{uid}/preferences/ritual (owner-only) so every device agrees.
 */
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebase } from "./firebase";
import { celebrate } from "./celebration";
import { getLocalOnboarding } from "./onboarding";

export type RitualDays = Record<string, number>;

const LOCAL_KEY = (uid: string) => `bookverse:ritual:${uid}`;
const SYNC_DELAY_MS = 20_000;

export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readLocal(uid: string): RitualDays {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(uid));
    return raw ? (JSON.parse(raw) as RitualDays) : {};
  } catch {
    return {};
  }
}

function writeLocal(uid: string, days: RitualDays) {
  try {
    // Keep ~ the last 400 days so the map never grows without bound.
    const keys = Object.keys(days).sort().slice(-400);
    localStorage.setItem(
      LOCAL_KEY(uid),
      JSON.stringify(Object.fromEntries(keys.map((k) => [k, days[k]]))),
    );
  } catch {
    // storage unavailable
  }
}

const listeners = new Set<() => void>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUid: string | null = null;

function scheduleSync(uid: string) {
  pendingUid = uid;
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushRitual();
  }, SYNC_DELAY_MS);
}

/** Pushes local minutes to Firestore (best effort; never throws). */
export async function flushRitual(): Promise<void> {
  const uid = pendingUid;
  const fb = getFirebase();
  if (!uid || !fb) return;
  const days = readLocal(uid);
  const recent = Object.fromEntries(
    Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60),
  );
  try {
    await setDoc(
      doc(fb.db, "users", uid, "preferences", "ritual"),
      { days: recent, updatedAt: Date.now() },
      { merge: true },
    );
  } catch {
    // offline or denied — local copy stays and is retried next time
  }
}

/** Days in a row (ending today) with any reading. */
function streakFrom(days: RitualDays): number {
  let n = 0;
  const d = new Date();
  while ((days[dayKey(d)] ?? 0) > 0) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function celebrateDailyGoal(uid: string, key: string, goal: number, days: RitualDays) {
  const flag = `bookverse:goal-party:${uid}:${key}`;
  try {
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, "1");
  } catch {
    return;
  }
  const streak = streakFrom(days);
  celebrate(
    streak > 1
      ? {
          eyebrow: "Meta cumprida",
          title: `${streak} dias seguidos!`,
          body: `Você leu ${goal} minutos hoje. Volte amanhã para manter a sequência.`,
          share: `${streak} dias seguidos lendo no BookVerse!`,
        }
      : {
          eyebrow: "Meta cumprida",
          title: "Meta de hoje feita!",
          body: `Você leu ${goal} minutos hoje. Amanhã tem mais.`,
          share: "Bati minha meta de leitura de hoje no BookVerse!",
        },
  );
}

/** Adds active reading seconds to today's ritual. */
export function addReadingSeconds(uid: string, seconds: number) {
  if (seconds <= 0) return;
  const days = readLocal(uid);
  const key = dayKey();
  const before = days[key] ?? 0;
  const minutes = Math.round((before + seconds / 60) * 100) / 100;
  days[key] = Math.min(24 * 60, minutes);
  writeLocal(uid, days);
  const goal = getLocalOnboarding(uid)?.dailyMinutes ?? 20;
  if (before < goal && minutes >= goal) celebrateDailyGoal(uid, key, goal, days);
  listeners.forEach((l) => l());
  scheduleSync(uid);
}

/**
 * Counts active reading time while mounted (the reader). Time is added in
 * 15-second ticks, only while the tab is visible and the person touched,
 * scrolled or pressed a key within the last 90 seconds.
 */
export function useReadingTimer(uid: string | null) {
  useEffect(() => {
    if (!uid) return;
    let lastActivity = Date.now();
    const mark = () => {
      lastActivity = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity > 90_000) return;
      addReadingSeconds(uid, 15);
    }, 15_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRitual();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
      document.removeEventListener("visibilitychange", onHide);
      void flushRitual();
    };
  }, [uid]);
}

export interface RitualState {
  goal: number;
  todayMinutes: number;
  /** This week, Monday first. */
  week: { key: string; label: string; minutes: number; met: boolean; today: boolean }[];
  /** Every known day (local + account), YYYY-MM-DD → minutes. */
  days: RitualDays;
}

const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];

function buildState(days: RitualDays, goal: number): RitualState {
  // The current week, Monday to Sunday (S T Q Q S S D).
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const todayKey = dayKey(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = dayKey(d);
    const minutes = days[key] ?? 0;
    return {
      key,
      label: WEEKDAY[d.getDay()]!,
      minutes,
      met: minutes >= goal,
      today: key === todayKey,
    };
  });
  return { goal, todayMinutes: days[dayKey()] ?? 0, week, days };
}

/** Live ritual for the dashboard: local minutes merged with the account's. */
export function useRitual(uid: string | null): RitualState {
  const [state, setState] = useState<RitualState>(() => buildState({}, 20));

  useEffect(() => {
    if (!uid) return;
    const goal = getLocalOnboarding(uid)?.dailyMinutes ?? 20;
    let remote: RitualDays = {};
    const recompute = () => {
      const local = readLocal(uid);
      const merged: RitualDays = { ...remote };
      for (const [k, v] of Object.entries(local)) merged[k] = Math.max(v, merged[k] ?? 0);
      setState(buildState(merged, goal));
    };
    recompute();
    listeners.add(recompute);
    const fb = getFirebase();
    const unsub = fb
      ? onSnapshot(
          doc(fb.db, "users", uid, "preferences", "ritual"),
          (snap) => {
            remote = ((snap.data()?.days as RitualDays | undefined) ?? {}) as RitualDays;
            recompute();
          },
          () => {},
        )
      : () => {};
    return () => {
      listeners.delete(recompute);
      unsub();
    };
  }, [uid]);

  return state;
}
