/**
 * Personal library — books a user has saved/started. Stored at
 * `users/{uid}/library/{bookSlug}`.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  /** Present when this title can be opened in the in-app reader (sample
   * book or a public-domain Gutenberg title). Absent for catalog-only
   * entries (Google Books / Open Library), which link out to a details
   * page instead. */
  readerId?: string | null;
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

/**
 * Adds a book to the library, or refreshes it if already tracked. Adding an
 * already-tracked title never downgrades its status (e.g. re-discovering a
 * finished book from "Descobrir" won't reset it back to "quero-ler") and
 * never resets `addedAt` — it's idempotent and safe to call repeatedly.
 */
export async function addToLibrary(
  uid: string,
  book: BookMeta,
  status: LibraryStatus = "quero-ler",
): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const id = slugFor(book.title, book.author);
  const ref = doc(fb.db, "users", uid, "library", id);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Already tracked — refresh metadata (cover/readerId may have improved)
    // but keep the existing status/addedAt untouched.
    const existing = snap.data() as Partial<LibraryEntry>;
    await setDoc(
      ref,
      {
        title: book.title,
        author: book.author,
        cover: book.cover ?? existing.cover ?? null,
        readerId: book.readerId ?? existing.readerId ?? null,
      },
      { merge: true },
    );
    return;
  }

  await setDoc(ref, {
    title: book.title,
    author: book.author,
    cover: book.cover ?? null,
    readerId: book.readerId ?? null,
    status,
    addedAt: serverTimestamp(),
  });
  void awardXp(uid, 5);
}

/**
 * Called when a user opens a book in the reader. Upserts a library entry
 * with status "lendo" and the given `readerId` so it can be resumed later
 * from "Minha biblioteca" — this is what connects "reading" and "library"
 * into one flow. Never downgrades a book already marked "concluido".
 */
export async function markAsReading(
  uid: string,
  book: { title: string; author: string; cover: string | null },
  readerId: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const id = slugFor(book.title, book.author);
  const ref = doc(fb.db, "users", uid, "library", id);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existing = snap.data() as Partial<LibraryEntry>;
    const patch: Record<string, unknown> = {
      title: book.title,
      author: book.author,
      cover: book.cover ?? existing.cover ?? null,
      readerId,
    };
    if (existing.status !== "concluido") patch.status = "lendo";
    await setDoc(ref, patch, { merge: true });
    return;
  }

  await setDoc(ref, {
    title: book.title,
    author: book.author,
    cover: book.cover ?? null,
    readerId,
    status: "lendo",
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
  const snap = await getDoc(ref);
  const wasCompleted =
    snap.exists() && (snap.data() as Partial<LibraryEntry>).status === "concluido";
  await setDoc(ref, { status }, { merge: true });
  // Only award the completion bonus on the actual transition into
  // "concluido" — otherwise toggling the dropdown back and forth would
  // farm XP indefinitely.
  if (status === "concluido" && !wasCompleted) {
    void awardXp(uid, 50);
  }
}

export function subscribeLibrary(uid: string, cb: (entries: LibraryEntry[]) => void): Unsubscribe {
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
