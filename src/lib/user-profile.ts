/**
 * User profile + XP — backs the real ranking. Document lives at
 * `users/{uid}` with shape:
 *   { displayName, username, bio, email, photoURL, xp, booksCompleted, createdAt, updatedAt }
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
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";
import { getFirebase } from "./firebase";
import { withDeadline, withFallback } from "./async-utils";

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string | null;
  bio?: string | null;
  email: string | null;
  photoURL: string | null;
  /** A user-uploaded photo, stored as a small JPEG data URL — kept
   * separate from `photoURL` (which tracks the provider's photo, e.g.
   * Google) so `ensureUserProfile` re-syncing that field on sign-in never
   * clobbers a photo the person chose themselves. Takes priority over
   * `photoURL`. */
  customPhotoDataUrl?: string | null;
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
  /** Calendar-month metrics are reset lazily on the next authenticated
   * activity. They power the month ranking and the profile reading recap. */
  monthStart?: string;
  monthlyXp?: number;
  monthlyChaptersRead?: number;
  monthlyReadingMinutes?: number;
  /** Cumulative estimates only from explicitly completed chapters. */
  readingMinutes?: number;
  pagesRead?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 10000;

export type GamificationMilestone =
  | "book-added"
  | "chapter-completed"
  | "book-completed"
  | "diary-entry"
  | "review-published"
  | "reading-session";

/** Sends a bounded, idempotent event to the callable Function. The server
 * owns XP and ranking counters; callers never send a point total. */
export async function recordGamificationMilestone(
  type: GamificationMilestone,
  resourceId: string,
  details: {
    chapterIndex?: number;
    chapterCount?: number;
    pagesRead?: number;
    readingMinutes?: number;
  } = {},
): Promise<void> {
  const fb = getFirebase();
  if (!fb || !resourceId) return;
  try {
    const call = httpsCallable<
      { type: GamificationMilestone; resourceId: string } & typeof details,
      { accepted: boolean }
    >(getFunctions(fb.app), "recordReadingMilestone", { timeout: 12_000 });
    await call({ type, resourceId: resourceId.slice(0, 180), ...details });
  } catch (err) {
    // Never interrupt the book itself for a non-essential score update.
    console.warn("[user-profile] milestone failed", err);
  }
}

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

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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
          monthStart: null,
          monthlyXp: 0,
          monthlyChaptersRead: 0,
          monthlyReadingMinutes: 0,
          readingMinutes: 0,
          pagesRead: 0,
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
    // A custom BookVerse photo takes precedence. Once it exists, keeping
    // rewriting the provider (Google) photo at sign-in only causes a brief
    // flash of the wrong avatar before the custom photo is painted.
    if (!data.customPhotoDataUrl && user.photoURL && data.photoURL !== user.photoURL) {
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
  // Kept only as a compatibility export for older UI modules. New code must
  // use `recordGamificationMilestone`, whose score is decided server-side.
  console.warn("[user-profile] awardXp is deprecated", { uid, amount });
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
  opts: {
    chapterCompleted?: boolean;
    bookAdded?: boolean;
    /** Estimated only when a chapter was explicitly confirmed. Bounds make
     * accidental duplicate UI events harmless. */
    readingMinutes?: number;
    pagesRead?: number;
  } = {},
): Promise<void> {
  const day = localDateKey(new Date());
  if (opts.chapterCompleted) {
    console.warn("[user-profile] chapter activity requires its chapter milestone", { uid });
    return;
  }
  await recordGamificationMilestone("reading-session", day);
}

export async function incrementBooksCompleted(uid: string): Promise<void> {
  console.warn("[user-profile] incrementBooksCompleted is deprecated", { uid });
}

/** Updates editable profile fields.
 * Throws on failure so the settings page can show a clear error. */
export async function updateProfileFields(
  uid: string,
  patch: {
    displayName?: string;
    username?: string | null;
    bio?: string | null;
    customPhotoDataUrl?: string | null;
  },
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

  // Imported files are deliberately removed before their account metadata
  // and Auth record. A failed Storage delete must stop account deletion so
  // we never claim a private EPUB/PDF has gone away when it is still in the
  // cloud. The operations are idempotent, so the person can safely retry.
  try {
    const removeOrphans = httpsCallable<undefined, { deleted: boolean }>(
      getFunctions(fb.app),
      "deletePrivateFiles",
      { timeout: 20_000 },
    );
    await removeOrphans();
    const [{ deleteEpubBook, deleteEpubBookFromCloud }, { deletePdfBook, deletePdfBookFromCloud }] =
      await Promise.all([import("./epub-store"), import("./pdf-store")]);
    const [epubs, pdfs] = await Promise.all([
      withDeadline(
        getDocs(collection(fb.db, "users", uid, "epubFiles")),
        WRITE_TIMEOUT_MS,
        "timeout",
      ),
      withDeadline(
        getDocs(collection(fb.db, "users", uid, "pdfFiles")),
        WRITE_TIMEOUT_MS,
        "timeout",
      ),
    ]);
    await Promise.all(
      epubs.docs.map(async (file) => {
        await deleteEpubBookFromCloud(uid, file.id);
        await deleteEpubBook(file.id).catch(() => {});
      }),
    );
    await Promise.all(
      pdfs.docs.map(async (file) => {
        await deletePdfBookFromCloud(uid, file.id);
        await deletePdfBook(file.id).catch(() => {});
      }),
    );
  } catch (err) {
    console.warn("[user-profile] private file deletion failed", err);
    throw new Error("Não foi possível remover todos os seus arquivos privados. Tente novamente.");
  }

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
  await deleteCollection(`users/${uid}/goals`);
  await deleteCollection(`users/${uid}/diary`);
  await deleteCollection(`users/${uid}/preferences`);

  // Resenhas publicadas vivem fora do espaço do usuário
  // (books/{livro}/reviews/{uid}); o espelho em reviewIndex permite
  // localizá-las sem collection group query.
  try {
    const snap = await withDeadline(
      getDocs(collection(fb.db, "users", uid, "reviewIndex")),
      WRITE_TIMEOUT_MS,
      "timeout",
    );
    await Promise.all(
      snap.docs.map((d) => deleteDoc(doc(fb.db, "books", d.id, "reviews", uid)).catch(() => {})),
    );
  } catch (err) {
    console.warn("[user-profile] failed to delete reviews", err);
  }
  await deleteCollection(`users/${uid}/reviewIndex`);
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
