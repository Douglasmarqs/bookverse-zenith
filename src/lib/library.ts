/**
 * Personal library — books a user has saved/started. Stored at
 * `users/{uid}/library/{bookSlug}`.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { awardXp } from "./user-profile";
import type { BookMeta } from "./google-books";

export type LibraryStatus = "quero-ler" | "lendo" | "concluido";

export interface LibraryEntry extends BookMeta {
  id: string;
  status: LibraryStatus;
  addedAt?: unknown;
}

export function slugFor(title: string, author?: string): string {
  return `${title}-${author ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 140);
}

export async function addToLibrary(
  uid: string,
  book: BookMeta,
  status: LibraryStatus = "quero-ler",
): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const id = slugFor(book.title, book.author);
  const ref = doc(fb.db, "users", uid, "library", id);
  await setDoc(ref, {
    title: book.title,
    author: book.author,
    cover: book.cover,
    status,
    addedAt: serverTimestamp(),
  });
  void awardXp(uid, 5);
}

export async function removeFromLibrary(uid: string, id: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  await deleteDoc(doc(fb.db, "users", uid, "library", id));
}

export async function setLibraryStatus(
  uid: string,
  id: string,
  status: LibraryStatus,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const ref = doc(fb.db, "users", uid, "library", id);
  await setDoc(ref, { status }, { merge: true });
  if (status === "concluido") {
    void awardXp(uid, 50);
  }
}

export function subscribeLibrary(
  uid: string,
  cb: (entries: LibraryEntry[]) => void,
): Unsubscribe {
  const fb = getFirebase();
  if (!fb) {
    cb([]);
    return () => {};
  }
  const ref = collection(fb.db, "users", uid, "library");
  return onSnapshot(
    ref,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LibraryEntry, "id">) })));
    },
    (err) => {
      console.warn("[library] subscribe failed", err);
      cb([]);
    },
  );
}
