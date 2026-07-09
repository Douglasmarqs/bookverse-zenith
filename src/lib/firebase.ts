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

/** Ensures a signed-in user (anonymous by default) and resolves with the uid. */
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
