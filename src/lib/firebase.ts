/**
 * Firebase client — singletons for app / auth / firestore.
 *
 * The web `apiKey` is a public identifier (security enforced via Firestore
 * Rules + App Check, not by hiding it). It is injected at build time from
 * the `GOOGLE_API_KEY` secret through `vite.define` (see vite.config.ts).
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithPopup,
  linkWithCredential,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

declare const __FIREBASE_API_KEY__: string;

const firebaseConfig = {
  apiKey: typeof __FIREBASE_API_KEY__ !== "undefined" ? __FIREBASE_API_KEY__ : "",
  authDomain: "bookverse-8147a.firebaseapp.com",
  projectId: "bookverse-8147a",
  storageBucket: "bookverse-8147a.firebasestorage.app",
  messagingSenderId: "444153208139",
  appId: "1:444153208139:web:a00f000f52504bdc3e5cce",
  measurementId: "G-S5PBNDH0CC",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

/** True once the app has a non-empty apiKey — i.e. GOOGLE_API_KEY was set at
 * build time. Use this to show an actionable message instead of letting
 * every auth/Firestore call fail silently one by one. */
export function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.apiKey;
}

export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!isBrowser()) return null;
  if (!firebaseConfig.apiKey) {
    console.warn("[firebase] apiKey missing — set GOOGLE_API_KEY secret.");
    return null;
  }
  if (!_app) {
    _app = getApps()[0] ?? initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
  }
  return { app: _app!, auth: _auth!, db: _db! };
}

/** Ensures a signed-in user (anonymous by default) and resolves with the user. */
export function ensureUser(): Promise<User | null> {
  const fb = getFirebase();
  if (!fb) return Promise.resolve(null);
  const { auth } = fb;
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    });
    signInAnonymously(auth).catch((err) => {
      console.warn("[firebase] anonymous sign-in failed", err);
      unsub();
      resolve(null);
    });
  });
}

/** Subscribe to auth state changes. */
export function subscribeAuth(cb: (user: User | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(fb.auth, cb);
}

/**
 * Sign in with Google. If the current user is anonymous, links the Google
 * credential to preserve uid and progress. Falls back to plain sign-in when
 * the Google account is already linked to another user.
 */
export async function signInWithGoogle(): Promise<User> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase not initialized");
  const provider = new GoogleAuthProvider();
  const current = fb.auth.currentUser;
  if (current?.isAnonymous) {
    try {
      const cred = await linkWithPopup(current, provider);
      return cred.user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        // Existing account owns this Google identity — sign in normally.
        const cred = await signInWithPopup(fb.auth, provider);
        return cred.user;
      }
      throw err;
    }
  }
  const cred = await signInWithPopup(fb.auth, provider);
  return cred.user;
}

/**
 * Sign in with email/password. If anonymous, tries to link credentials to
 * preserve uid; falls back to normal sign-in when the account already exists.
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase not initialized");
  const current = fb.auth.currentUser;
  if (current?.isAnonymous) {
    const credential = EmailAuthProvider.credential(email, password);
    try {
      const cred = await linkWithCredential(current, credential);
      return cred.user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        const cred = await signInWithEmailAndPassword(fb.auth, email, password);
        return cred.user;
      }
      throw err;
    }
  }
  const cred = await signInWithEmailAndPassword(fb.auth, email, password);
  return cred.user;
}

/**
 * Sign up with email/password. Upgrades an anonymous account by linking the
 * new credential; keeps existing uid and Firestore data.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase not initialized");
  const current = fb.auth.currentUser;
  let user: User;
  if (current?.isAnonymous) {
    const credential = EmailAuthProvider.credential(email, password);
    const cred = await linkWithCredential(current, credential);
    user = cred.user;
  } else {
    const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
    user = cred.user;
  }
  if (displayName && displayName.trim()) {
    await updateProfile(user, { displayName: displayName.trim() });
  }
  return user;
}

export async function signOut(): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  await fbSignOut(fb.auth);
}
