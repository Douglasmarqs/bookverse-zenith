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

/**
 * Creates the user's profile doc on first sign-in (real account, not
 * anonymous) and keeps display fields fresh. Safe to call on every auth
 * state change — it only writes when something actually changed.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  if (user.isAnonymous) return;
  const fb = getFirebase();
  if (!fb) return;

  const ref = doc(fb.db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName || user.email?.split("@")[0] || "Leitor",
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      xp: 0,
      booksCompleted: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
    await setDoc(ref, patch, { merge: true });
  }
}

/** Awards XP to a user (e.g. finishing a chapter, adding a book). */
export async function awardXp(uid: string, amount: number): Promise<void> {
  const fb = getFirebase();
  if (!fb || amount <= 0) return;
  const ref = doc(fb.db, "users", uid);
  try {
    await setDoc(
      ref,
      { xp: increment(amount), updatedAt: serverTimestamp() },
      { merge: true },
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
    await setDoc(
      ref,
      { booksCompleted: increment(1), updatedAt: serverTimestamp() },
      { merge: true },
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
