/**
 * Reader store — settings + progress persistence.
 *
 * Local-first (localStorage) with Firebase Firestore sync when signed in.
 * Progress is stored at `users/{uid}/progress/{bookId}`.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { ensureUser, getFirebase } from "./firebase";

export type ReaderTheme = "light" | "sepia" | "dark";
export type ReaderFont = "serif" | "sans";
export type ReaderMode = "scroll" | "paginated";

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number;
  lineHeight: number;
  margin: number;
  maxWidth: number;
  mode: ReaderMode;
}

export interface ReadingProgress {
  chapterIndex: number;
  scrollRatio: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "dark",
  font: "serif",
  fontSize: 18,
  lineHeight: 1.7,
  margin: 32,
  maxWidth: 66,
  mode: "scroll",
};

const SETTINGS_KEY = "bookverse:reader:settings";
const progressKey = (bookId: string) => `bookverse:reader:progress:${bookId}`;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

export function loadSettings(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  return safeParse(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS);
}

export function saveSettings(s: ReaderSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadProgressLocal(bookId: string): ReadingProgress | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(progressKey(bookId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReadingProgress;
  } catch {
    return null;
  }
}

/** Back-compat alias — returns local progress immediately (sync). */
export const loadProgress = loadProgressLocal;

/**
 * Loads progress with a Firestore fallback. Returns the newest of remote/local
 * (by `updatedAt`) and reconciles both caches.
 */
export async function loadProgressRemote(
  bookId: string,
): Promise<ReadingProgress | null> {
  const local = loadProgressLocal(bookId);
  const fb = getFirebase();
  if (!fb) return local;
  try {
    const user = await ensureUser();
    if (!user) return local;
    const ref = doc(fb.db, "users", user.uid, "progress", bookId);
    const snap = await getDoc(ref);
    const remote = snap.exists() ? (snap.data() as ReadingProgress) : null;
    if (remote && (!local || remote.updatedAt > local.updatedAt)) {
      localStorage.setItem(progressKey(bookId), JSON.stringify(remote));
      return remote;
    }
    if (local && (!remote || local.updatedAt > (remote?.updatedAt ?? 0))) {
      // Push newer local up to remote.
      await setDoc(ref, local, { merge: true });
    }
    return local ?? remote;
  } catch (err) {
    console.warn("[reader] loadProgressRemote failed", err);
    return local;
  }
}

export function saveProgress(bookId: string, p: ReadingProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(progressKey(bookId), JSON.stringify(p));
  void writeRemote(bookId, p);
}

async function writeRemote(bookId: string, p: ReadingProgress): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  try {
    const user = await ensureUser();
    if (!user) return;
    const ref = doc(fb.db, "users", user.uid, "progress", bookId);
    await setDoc(
      ref,
      { ...p, bookId, uid: user.uid, syncedAt: Date.now() },
      { merge: true },
    );
  } catch (err) {
    console.warn("[reader] writeRemote failed", err);
  }
}
