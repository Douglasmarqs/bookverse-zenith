/**
 * Reader store — settings + progress persistence.
 *
 * Local-first (localStorage) with Firebase Firestore sync when signed in.
 * Progress is stored at `users/{uid}/progress/{bookId}`.
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureUser } from "./firebase";
import { getFirebase } from "./firebase-services";
import { withDeadline, withFallback } from "./async-utils";
import {
  differentReadingPosition,
  legacyRecovery,
  mergeCompletionMarkers,
  reconcileProgress,
  type ProgressConflict,
} from "./progress-reconcile";

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
  /** Stable position within the normalized chapter text. Virtual page numbers
   * change with font, orientation and viewport size. */
  paragraphIndex?: number;
  /** Overall location in the book. Kept alongside the chapter position so
   * dashboards can render honest progress without loading the book source. */
  overallRatio?: number;
  chapterCount?: number;
  pageIndex?: number;
  pageCount?: number;
  /** Relative pan within an original PDF page; optional for old progress. */
  pdfViewport?: { x: number; y: number };
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
const PENDING_PROGRESS_KEY = (uid: string) => `bookverse:reader:pending-progress:v2:${uid}`;
// One-time migration flag — see loadSettings() below.
const PAGINATED_MIGRATION_KEY = "bookverse:reader:settings:paginated-default-v1";
const progressKey = (bookId: string, uid?: string) =>
  uid ? `bookverse:reader:progress:${uid}:${bookId}` : `bookverse:reader:progress:${bookId}`;
const remoteRevision = new Map<string, number>();
const reportedConflict = new Map<string, number>();
const revisionKey = (uid: string, bookId: string) => `${uid}:${bookId}`;
const clientId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export const PROGRESS_CONFLICT_EVENT = "bookverse:progress-conflict";
export type { ProgressConflict };
export interface ProgressConflictEvent extends ProgressConflict {
  bookId: string;
}

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
  let loaded = { ...DEFAULT_SETTINGS };
  try {
    loaded = safeParse(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS);
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
  } catch {
    // Browsers may deny storage or allow reads while the write quota is full.
    // Keep any preferences already loaded and allow reading in memory.
  }
  return loaded;
}

export function saveSettings(s: ReaderSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // The UI keeps these preferences in memory; remote sync can still succeed.
  }
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

export function loadProgressLocal(bookId: string, uid?: string): ReadingProgress | null {
  if (typeof window === "undefined") return null;
  // Legacy positions have no owner metadata. Never attach one to an account:
  // a shared browser could otherwise show another reader's private position.
  try {
    const raw = localStorage.getItem(progressKey(bookId, uid));
    if (!raw) return null;
    return JSON.parse(raw) as ReadingProgress;
  } catch {
    return null;
  }
}

function persistProgressLocal(bookId: string, uid: string, progress: ReadingProgress): void {
  try {
    localStorage.setItem(progressKey(bookId, uid), JSON.stringify(progress));
  } catch (error) {
    // Storage may be unavailable or full. The remote write can still succeed.
    console.warn("[reader] local progress storage unavailable", error);
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

/** Loads both positions without silently replacing either when devices differ. */
export async function loadProgressForReader(
  bookId: string,
  uid: string,
): Promise<{ progress: ReadingProgress | null; conflict: ProgressConflict | null }> {
  const local = loadProgressLocal(bookId, uid);
  const legacy = local ? null : loadProgressLocal(bookId);
  const fb = getFirebase();
  if (!fb) return { progress: local, conflict: null };
  try {
    const ref = doc(fb.db, "users", uid, "progress", bookId);
    const snap = await withFallback(getDoc(ref), 5000, null);
    if (!snap) return { progress: local, conflict: null };
    const remote = snap?.exists() ? (snap.data() as ReadingProgress) : null;
    remoteRevision.set(revisionKey(uid, bookId), remote?.updatedAt ?? 0);
    if (legacy) {
      // The old key does not identify its owner. Offer recovery explicitly;
      // never copy its position into a newly signed-in account on its own.
      return legacyRecovery(legacy, remote);
    }
    const result = reconcileProgress(local, remote);
    if (result.progress && !result.conflict && typeof window !== "undefined") {
      persistProgressLocal(bookId, uid, result.progress);
    }
    return result;
  } catch (err) {
    console.warn("[reader] loadProgressRemote failed", err);
    return { progress: local, conflict: null };
  }
}

/** Compatibility helper for noninteractive consumers. Reader screens use the
 * conflict-aware result above so the reader can choose the correct position. */
export async function loadProgressRemote(bookId: string): Promise<ReadingProgress | null> {
  const user = await withFallback(ensureUser(), 5000, null);
  if (!user) return loadProgressLocal(bookId);
  return (await loadProgressForReader(bookId, user.uid)).progress;
}

export function acceptRemoteProgress(
  bookId: string,
  uid: string,
  remote: ReadingProgress,
  local: ReadingProgress,
  legacy = false,
): ReadingProgress {
  const selected = legacy ? remote : mergeCompletionMarkers(remote, local);
  if (typeof window === "undefined") return selected;
  persistProgressLocal(bookId, uid, selected);
  remoteRevision.set(revisionKey(uid, bookId), remote.updatedAt);
  reportedConflict.delete(revisionKey(uid, bookId));
  clearPendingProgress(uid, bookId);
  return selected;
}

export function acceptLocalProgress(
  bookId: string,
  uid: string,
  local: ReadingProgress,
  remote: ReadingProgress,
): ReadingProgress {
  remoteRevision.set(revisionKey(uid, bookId), remote.updatedAt);
  reportedConflict.delete(revisionKey(uid, bookId));
  const selected = {
    ...mergeCompletionMarkers(local, remote),
    updatedAt: Math.max(Date.now(), remote.updatedAt + 1),
  };
  saveProgress(bookId, selected, uid);
  return selected;
}

export function saveProgress(bookId: string, p: ReadingProgress, uid: string): void {
  if (typeof window === "undefined") return;
  persistProgressLocal(bookId, uid, p);
  queuePendingProgress(uid, bookId, p);
  void writeRemote(uid, bookId, p);
}

function pendingProgress(uid: string): Record<string, ReadingProgress> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PENDING_PROGRESS_KEY(uid)) ?? "{}") as Record<
      string,
      ReadingProgress
    >;
  } catch {
    return {};
  }
}

function queuePendingProgress(uid: string, bookId: string, progress: ReadingProgress) {
  if (typeof window === "undefined") return;
  try {
    const queued = pendingProgress(uid);
    queued[bookId] = progress;
    localStorage.setItem(PENDING_PROGRESS_KEY(uid), JSON.stringify(queued));
  } catch {
    // local progress still exists under its own compact key.
  }
}

function clearPendingProgress(uid: string, bookId: string, updatedAt?: number) {
  if (typeof window === "undefined") return;
  try {
    const queued = pendingProgress(uid);
    if (updatedAt === undefined || queued[bookId]?.updatedAt === updatedAt) {
      delete queued[bookId];
      localStorage.setItem(PENDING_PROGRESS_KEY(uid), JSON.stringify(queued));
    }
  } catch {
    // A stale queue is safe: the newest timestamp wins on the next sync.
  }
}

async function writeRemote(uid: string, bookId: string, p: ReadingProgress): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  try {
    const user = await withFallback(ensureUser(), 5000, null);
    if (!user || user.uid !== uid) return;
    const ref = doc(fb.db, "users", uid, "progress", bookId);
    const key = revisionKey(uid, bookId);
    const expectedRevision = remoteRevision.get(key);
    const result = await withDeadline(
      runTransaction(fb.db, async (transaction) => {
        const snap = await transaction.get(ref);
        const remote = snap.exists()
          ? (snap.data() as ReadingProgress & { clientId?: string })
          : null;
        // Two writes from this tab can finish out of order. The older one
        // must not move the cloud position backward after the newer one lands.
        if (remote?.clientId === clientId && remote.updatedAt > p.updatedAt) {
          return { conflict: null, saved: remote };
        }
        const changedSinceRead =
          remote &&
          remote.clientId !== clientId &&
          (expectedRevision === undefined || remote.updatedAt !== expectedRevision);
        if (changedSinceRead && differentReadingPosition(p, remote)) {
          return { conflict: remote, saved: null };
        }
        const saved = remote ? mergeCompletionMarkers(p, remote) : p;
        saved.updatedAt = Math.max(saved.updatedAt, remote?.updatedAt ?? 0);
        transaction.set(
          ref,
          { ...saved, bookId, uid, clientId, syncedAt: Date.now() },
          { merge: true },
        );
        return { conflict: null, saved };
      }),
      8000,
      "timeout",
    );
    if (result.conflict) {
      if (
        reportedConflict.get(key) !== result.conflict.updatedAt &&
        typeof window !== "undefined"
      ) {
        reportedConflict.set(key, result.conflict.updatedAt);
        window.dispatchEvent(
          new CustomEvent<ProgressConflictEvent>(PROGRESS_CONFLICT_EVENT, {
            detail: { bookId, local: p, remote: result.conflict },
          }),
        );
      }
      return;
    }
    remoteRevision.set(key, result.saved?.updatedAt ?? p.updatedAt);
    clearPendingProgress(uid, bookId, p.updatedAt);
  } catch (err) {
    console.warn("[reader] writeRemote failed", err);
  }
}

/** Retries local-first saves after an offline reader reconnects. This is
 * intentionally tiny and timestamp-based, so it cannot overwrite a newer
 * position stored by another device. */
export function flushPendingProgress(): void {
  if (typeof window === "undefined" || !navigator.onLine) return;
  void ensureUser()
    .then((user) => {
      if (!user) return;
      const queued = pendingProgress(user.uid);
      Object.entries(queued).forEach(
        ([bookId, progress]) => void writeRemote(user.uid, bookId, progress),
      );
    })
    .catch((error) => console.warn("[reader] pending progress sync failed", error));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", flushPendingProgress, { passive: true });
}
