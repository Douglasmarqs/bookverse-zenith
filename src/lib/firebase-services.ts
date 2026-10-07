/** Firestore and Storage stay in this feature module so public pages that only
 * need authentication do not download either SDK. */
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

import { getFirebaseAuth, usesFirebaseEmulators } from "./firebase";

let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebase(): {
  app: NonNullable<ReturnType<typeof getFirebaseAuth>>["app"];
  auth: NonNullable<ReturnType<typeof getFirebaseAuth>>["auth"];
  db: Firestore;
  storage: FirebaseStorage;
} | null {
  const base = getFirebaseAuth();
  if (!base) return null;

  if (!db) {
    // Durable multi-tab cache keeps library/progress writes queued through a
    // temporary mobile connection loss and flushes them when the device is online.
    try {
      db = initializeFirestore(base.app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch (error) {
      console.warn("[firebase] persistent cache unavailable; using memory cache", error);
      db = getFirestore(base.app);
    }
    storage = getStorage(base.app);
    if (usesFirebaseEmulators()) {
      connectFirestoreEmulator(db, "127.0.0.1", 8085);
      connectStorageEmulator(storage, "127.0.0.1", 9199);
    }
  }

  return { ...base, db, storage: storage! };
}
