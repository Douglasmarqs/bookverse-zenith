/**
 * User profile + XP — backs the real ranking. Document lives at
 * `users/{uid}` with shape:
 *   { displayName, email, photoURL, xp, booksCompleted, createdAt, updatedAt }
 *
 * Requires a Firestore security rule allowing:
 *   - read: anyone signed in (ranking needs to read other users' public fields)
 *   - write: only the owner (`request.auth.uid == uid`)
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebase } from "./firebase";
import { withDeadline, withFallback } from "./async-utils";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  /** A short emoji chosen from the in-app avatar picker — takes priority
   * over `photoURL` for display when set (see components that render it). */
  avatarEmoji?: string | null;
  xp: number;
  booksCompleted: number;
  /** Total chapters finished across every book — the closest proxy we
   * have to "pages read" without per-book pagination data. */
  chaptersRead?: number;
  /** Consecutive days with any reading activity (opening a book or
   * finishing a chapter counts). */
  currentStreak?: number;
  longestStreak?: number;
  /** YYYY-MM-DD (local date) of the last day that counted toward the
   * streak — used to tell "still today", "continues from yesterday", or
   * "streak broken" apart. */
  lastActiveDate?: string;
  /** Monday (YYYY-MM-DD) of the week the counters below apply to — reset
   * automatically once a new week starts. */
  weekStart?: string;
  weeklyChaptersRead?: number;
  weeklyXp?: number;
  weeklyBooksAdded?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 10000;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d`, as a local YYYY-MM-DD key — used to
 * reset the weekly mission counters when a new week starts. */
function mondayKey(d: Date): string {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return localDateKey(date);
}

/**
 * Creates the user's profile doc on first sign-in (real account, not
 * anonymous) and keeps display fields fresh. Safe to call on every auth
 * state change — it only writes when something actually changed. Never
 * throws — this is called fire-and-forget from the header on every auth
 * change, so failures are logged, not surfaced.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  if (user.isAnonymous) return;
  const fb = getFirebase();
  if (!fb) return;

  try {
    const ref = doc(fb.db, "users", user.uid);
    const snap = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null);
    if (!snap) return; // couldn't confirm either way within the deadline — skip, try again next auth event

    if (!snap.exists()) {
      await withDeadline(
        setDoc(ref, {
          uid: user.uid,
          displayName: user.displayName || user.email?.split("@")[0] || "Leitor",
          email: user.email ?? null,
          photoURL: user.photoURL ?? null,
          xp: 0,
          booksCompleted: 0,
          chaptersRead: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: null,
          weekStart: null,
          weeklyChaptersRead: 0,
          weeklyXp: 0,
          weeklyBooksAdded: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        WRITE_TIMEOUT_MS,
        "timeout",
      );
      return;
    }

    const data = snap.data();
    const patch: Record<string, unknown> = {};
    if (user.displayName && data.displayName !== user.displayName) {
      patch.displayName = user.displayName;
    }
    if (user.photoURL && data.photoURL !== user.photoURL) {
      patch.photoURL = user.photoURL;
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp();
      await withDeadline(setDoc(ref, patch, { merge: true }), WRITE_TIMEOUT_MS, "timeout");
    }
  } catch (err) {
    console.warn("[user-profile] ensureUserProfile failed", err);
  }
}

/** Awards XP to a user (e.g. finishing a chapter, adding a book). */
export async function awardXp(uid: string, amount: number): Promise<void> {
  const fb = getFirebase();
  if (!fb || amount <= 0) return;
  const ref = doc(fb.db, "users", uid);
  try {
    const snap = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null);
    const data = (snap?.data() as Partial<UserProfile>) ?? {};
    const thisMonday = mondayKey(new Date());
    const sameWeek = data.weekStart === thisMonday;

    const patch: Record<string, unknown> = {
      xp: increment(amount),
      updatedAt: serverTimestamp(),
      weeklyXp: (sameWeek ? (data.weeklyXp ?? 0) : 0) + amount,
    };
    if (!sameWeek) {
      patch.weekStart = thisMonday;
      patch.weeklyChaptersRead = 0;
      patch.weeklyBooksAdded = 0;
    }
    await withDeadline(setDoc(ref, patch, { merge: true }), WRITE_TIMEOUT_MS, "timeout");
  } catch (err) {
    console.warn("[user-profile] awardXp failed", err);
  }
}

/**
 * Records reading activity for streak + weekly mission tracking. Call this
 * when a user opens a book (keeps the streak alive) and/or finishes a
 * chapter (counts toward "pages read" achievements and the weekly
 * mission). Never throws — this runs alongside the main action, not
 * instead of it.
 */
export async function recordReadingActivity(
  uid: string,
  opts: { chapterCompleted?: boolean; bookAdded?: boolean } = {},
): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const ref = doc(fb.db, "users", uid);
  try {
    const snap = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null);
    const data = (snap?.data() as Partial<UserProfile>) ?? {};
    const now = new Date();
    const today = localDateKey(now);
    const thisMonday = mondayKey(now);
    const sameWeek = data.weekStart === thisMonday;

    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };

    // Streak — only re-evaluate once per calendar day, so opening the
    // book five times in one day doesn't inflate anything.
    if (data.lastActiveDate !== today) {
      const prevDate = data.lastActiveDate ? new Date(`${data.lastActiveDate}T00:00:00`) : null;
      const daysSince = prevDate
        ? Math.round((new Date(`${today}T00:00:00`).getTime() - prevDate.getTime()) / 86400000)
        : null;
      const newStreak = daysSince === 1 ? (data.currentStreak ?? 0) + 1 : 1;
      patch.currentStreak = newStreak;
      patch.longestStreak = Math.max(newStreak, data.longestStreak ?? 0);
      patch.lastActiveDate = today;
    }

    // Weekly mission counters — reset automatically when a new week starts.
    patch.weekStart = thisMonday;
    patch.weeklyChaptersRead =
      (sameWeek ? (data.weeklyChaptersRead ?? 0) : 0) + (opts.chapterCompleted ? 1 : 0);
    patch.weeklyBooksAdded =
      (sameWeek ? (data.weeklyBooksAdded ?? 0) : 0) + (opts.bookAdded ? 1 : 0);
    if (!sameWeek) patch.weeklyXp = 0;

    if (opts.chapterCompleted) {
      patch.chaptersRead = (data.chaptersRead ?? 0) + 1;
    }

    await withDeadline(setDoc(ref, patch, { merge: true }), WRITE_TIMEOUT_MS, "timeout");
  } catch (err) {
    console.warn("[user-profile] recordReadingActivity failed", err);
  }
}

export async function incrementBooksCompleted(uid: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const ref = doc(fb.db, "users", uid);
  try {
    await withDeadline(
      setDoc(ref, { booksCompleted: increment(1), updatedAt: serverTimestamp() }, { merge: true }),
      WRITE_TIMEOUT_MS,
      "timeout",
    );
  } catch (err) {
    console.warn("[user-profile] incrementBooksCompleted failed", err);
  }
}

/** Updates editable profile fields (display name, chosen avatar emoji).
 * Throws on failure so the settings page can show a clear error. */
export async function updateProfileFields(
  uid: string,
  patch: { displayName?: string; avatarEmoji?: string | null },
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  const ref = doc(fb.db, "users", uid);
  await withDeadline(
    setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível salvar seu perfil agora. Tente novamente.",
  );
}

/** Deletes every Firestore document belonging to a user — profile,
 * library, and reading progress. Used before/after deleting the Auth
 * account itself (see lib/firebase.ts's deleteAccount). Best-effort per
 * subcollection so a partial failure doesn't block the rest. */
export async function deleteUserData(uid: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;

  async function deleteCollection(path: string) {
    try {
      const snap = await withDeadline(
        getDocs(collection(fb!.db, path)),
        WRITE_TIMEOUT_MS,
        "timeout",
      );
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    } catch (err) {
      console.warn(`[user-profile] failed to delete ${path}`, err);
    }
  }

  await deleteCollection(`users/${uid}/library`);
  await deleteCollection(`users/${uid}/progress`);
  await deleteCollection(`users/${uid}/annotations`);
  await deleteCollection(`users/${uid}/lumi`);
  try {
    await deleteDoc(doc(fb.db, "users", uid));
  } catch (err) {
    console.warn("[user-profile] failed to delete profile doc", err);
  }
}

/** Live-subscribes to a single user's profile doc. */
export function subscribeUserProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void,
): Unsubscribe {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  const ref = doc(fb.db, "users", uid);
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? ({ uid, ...snap.data() } as UserProfile) : null),
    (err) => {
      console.warn("[user-profile] subscribe failed", err);
      cb(null);
    },
  );
}
