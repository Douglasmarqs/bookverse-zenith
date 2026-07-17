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
  doc,
  getDoc,
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
  xp: number;
  booksCompleted: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 10000;

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
    await withDeadline(
      setDoc(ref, { xp: increment(amount), updatedAt: serverTimestamp() }, { merge: true }),
      WRITE_TIMEOUT_MS,
      "timeout",
    );
  } catch (err) {
    console.warn("[user-profile] awardXp failed", err);
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
