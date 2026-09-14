/**
 * Reader store — settings + progress persistence.
 *
 * Local-first (localStorage) with Firebase Firestore sync when signed in.
 * Progress is stored at `users/{uid}/progress/{bookId}`.
 */

import { collection, doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { ensureUser, getFirebase } from "./firebase";
import { withDeadline, withFallback } from "./async-utils";

export type ReaderTheme = "light" | "paper" | "sepia" | "dark" | "amoled";
export type ReaderFont = "serif" | "sans";
export type ReaderMode = "scroll" | "paginated";
export type ReaderAlignment = "justify" | "left";

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  margin: number;
  maxWidth: number;
  alignment: ReaderAlignment;
  mode: ReaderMode;
  /** When enabled, a one-page navigation folds the previous virtual page
   * away like a paper leaf. Kept optional for backwards-compatible saved
   * preferences from older BookVerse versions. */
  pageTurn?: boolean;
  /** Millisecond client timestamp used only to reconcile preferences across
   * devices. Reading settings are personal presentation data, not stats. */
  updatedAt?: number;
}

export interface ReadingProgress {
  chapterIndex: number;
  scrollRatio: number;
  /** Overall location in the book. Kept alongside the chapter position so
   * dashboards can render honest progress without loading the book source. */
  overallRatio?: number;
  chapterCount?: number;
  pageIndex?: number;
  pageCount?: number;
  /** Chapters explicitly confirmed by the reader. Keeping the ids in the
   * progress document makes the completion reward idempotent across reloads
   * and devices; merely jumping through the table of contents never counts
   * as reading. */
  completedChapterIndexes?: number[];
  /** Set only after the one-time book-completion action has been recorded. */
  bookCompletionRecorded?: boolean;
  updatedAt: number;
}

export interface StoredReadingProgress extends ReadingProgress {
  bookId: string;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "paper",
  font: "serif",
  fontSize: 18,
  lineHeight: 1.7,
  paragraphSpacing: 0.85,
  margin: 32,
  maxWidth: 66,
  alignment: "justify",
  mode: "paginated",
  pageTurn: true,
};

const SETTINGS_KEY = "bookverse:reader:settings";
const PENDING_PROGRESS_KEY = "bookverse:reader:pending-progress:v1";
// One-time migration flag — see loadSettings() below.
const PAGINATED_MIGRATION_KEY = "bookverse:reader:settings:paginated-default-v1";
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
  const loaded = safeParse(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS);
  // Paginated reading became the default mode after some devices had
  // already saved an explicit "scroll" from the old default — and an
  // explicitly-saved value always wins over a new default, so without
  // this those devices would silently be stuck on "scroll" forever. Runs
  // once per device/browser; a person who deliberately switches back to
  // Rolagem afterward has that respected normally from then on.
  if (!localStorage.getItem(PAGINATED_MIGRATION_KEY)) {
    localStorage.setItem(PAGINATED_MIGRATION_KEY, "1");
    if (loaded.mode === "scroll") {
      loaded.mode = "paginated";
      saveSettings(loaded);
    }
  }
  return loaded;
}

export function saveSettings(s: ReaderSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/** Loads the newest known preference set for the signed-in reader. Local
 * settings keep the reader usable offline; Firestore simply reconciles them
 * when the account is available again. */
export async function loadSettingsRemote(
  uid: string,
  local: ReaderSettings,
): Promise<ReaderSettings> {
  const fb = getFirebase();
  if (!fb) return local;
  try {
    const snap = await withFallback(
      getDoc(doc(fb.db, "users", uid, "preferences", "reader")),
      5000,
      null,
    );
    const remote = snap?.exists()
      ? ({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ReaderSettings>) } as ReaderSettings)
      : null;
    if (!remote || (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0)) return local;
    saveSettings(remote);
    return remote;
  } catch (err) {
    console.warn("[reader] loadSettingsRemote failed", err);
    return local;
  }
}

/** Best-effort account sync. A local save has already succeeded before this
 * runs, so a transient network failure must never interrupt reading. */
export async function saveSettingsRemote(uid: string, settings: ReaderSettings): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  try {
    await withDeadline(
      setDoc(
        doc(fb.db, "users", uid, "preferences", "reader"),
        { ...settings, updatedAt: settings.updatedAt ?? Date.now() },
        { merge: true },
      ),
      8000,
      "timeout",
    );
  } catch (err) {
    console.warn("[reader] saveSettingsRemote failed", err);
  }
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

/** Live account progress for the library and Home dashboard. The reader still
 * works entirely offline; this listener is only attached for signed-in views. */
export function subscribeReadingProgress(
  uid: string,
  callback: (items: StoredReadingProgress[]) => void,
): Unsubscribe {
  const fb = getFirebase();
  if (!fb) return () => undefined;
  return onSnapshot(
    collection(fb.db, "users", uid, "progress"),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((item) => ({ bookId: item.id, ...(item.data() as ReadingProgress) }))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
    },
    (error) => console.warn("[reader] subscribeReadingProgress failed", error),
  );
}

/**
 * Loads progress with a Firestore fallback. Returns the newest of remote/local
 * (by `updatedAt`) and reconciles both caches.
 */
export async function loadProgressRemote(bookId: string): Promise<ReadingProgress | null> {
  const local = loadProgressLocal(bookId);
  const fb = getFirebase();
  if (!fb) return local;
  try {
    const user = await withFallback(ensureUser(), 5000, null);
    if (!user) return local;
    const ref = doc(fb.db, "users", user.uid, "progress", bookId);
    const snap = await withFallback(getDoc(ref), 5000, null);
    const remote = snap?.exists() ? (snap.data() as ReadingProgress) : null;
    if (remote && (!local || remote.updatedAt > local.updatedAt)) {
      localStorage.setItem(progressKey(bookId), JSON.stringify(remote));
      return remote;
    }
    if (local && (!remote || local.updatedAt > (remote?.updatedAt ?? 0))) {
      // Push newer local up to remote — best effort, don't block on it.
      void withDeadline(setDoc(ref, local, { merge: true }), 8000, "timeout").catch((err) =>
        console.warn("[reader] push local progress failed", err),
      );
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
  queuePendingProgress(bookId, p);
  void writeRemote(bookId, p);
}

function pendingProgress(): Record<string, ReadingProgress> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PENDING_PROGRESS_KEY) ?? "{}") as Record<
      string,
      ReadingProgress
    >;
  } catch {
    return {};
  }
}

function queuePendingProgress(bookId: string, progress: ReadingProgress) {
  if (typeof window === "undefined") return;
  try {
    const queued = pendingProgress();
    queued[bookId] = progress;
    localStorage.setItem(PENDING_PROGRESS_KEY, JSON.stringify(queued));
  } catch {
    // local progress still exists under its own compact key.
  }
}

function clearPendingProgress(bookId: string, updatedAt: number) {
  if (typeof window === "undefined") return;
  try {
    const queued = pendingProgress();
    if (queued[bookId]?.updatedAt === updatedAt) {
      delete queued[bookId];
      localStorage.setItem(PENDING_PROGRESS_KEY, JSON.stringify(queued));
    }
  } catch {
    // A stale queue is safe: the newest timestamp wins on the next sync.
  }
}

async function writeRemote(bookId: string, p: ReadingProgress): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  try {
    const user = await withFallback(ensureUser(), 5000, null);
    if (!user) return;
    const ref = doc(fb.db, "users", user.uid, "progress", bookId);
    await withDeadline(
      setDoc(ref, { ...p, bookId, uid: user.uid, syncedAt: Date.now() }, { merge: true }),
      8000,
      "timeout",
    );
    clearPendingProgress(bookId, p.updatedAt);
  } catch (err) {
    console.warn("[reader] writeRemote failed", err);
  }
}

/** Retries local-first saves after an offline reader reconnects. This is
 * intentionally tiny and timestamp-based, so it cannot overwrite a newer
 * position stored by another device. */
export function flushPendingProgress(): void {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const queued = pendingProgress();
  Object.entries(queued).forEach(([bookId, progress]) => void writeRemote(bookId, progress));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", flushPendingProgress, { passive: true });
}
