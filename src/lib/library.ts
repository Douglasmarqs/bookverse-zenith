/**
 * Personal library — books a user has saved/started. Stored at
 * `users/{uid}/library/{bookSlug}`.
 *
 * Every write here is wrapped with `withDeadline` so a stalled network
 * round-trip surfaces a clear error within a few seconds instead of
 * leaving a button stuck on "Salvando…" forever. The optional read used to
 * check for an existing entry is wrapped with `withFallback` instead —
 * it's an optimization (preserve status/addedAt on repeat adds), not a
 * requirement, so if it stalls we just proceed with a plain write rather
 * than block the whole action on it.
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
import { withDeadline, withFallback } from "./async-utils";
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

const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 10000;
// Firestore caps documents at 1MB total. Covers are normally short URLs,
// but a locally-imported EPUB embeds its cover as a base64 data URL —
// epub-parser.ts already downscales those, but this is a defense-in-depth
// cap so an oversized cover degrades to "no cover" instead of failing the
// whole library write.
const MAX_COVER_LENGTH = 700_000;

function safeCover(cover: string | null | undefined): string | null {
  if (!cover) return null;
  return cover.length > MAX_COVER_LENGTH ? null : cover;
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
 *
 * Always settles within ~10s: resolves on success, throws a friendly Error
 * on failure/timeout so the caller can show it to the user.
 */
export async function addToLibrary(
  uid: string,
  book: BookMeta,
  status: LibraryStatus = "quero-ler",
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  const id = slugFor(book.title, book.author);
  const ref = doc(fb.db, "users", uid, "library", id);

  // Best-effort read: if it stalls or fails, we just fall through to
  // "create new" below instead of hanging the whole action on it.
  const existing = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null).catch(() => null);

  if (existing && existing.exists()) {
    const data = existing.data() as Partial<LibraryEntry>;
    await withDeadline(
      setDoc(
        ref,
        {
          title: book.title,
          author: book.author,
          cover: safeCover(book.cover) ?? safeCover(data.cover as string | null | undefined),
          readerId: book.readerId ?? data.readerId ?? null,
        },
        { merge: true },
      ),
      WRITE_TIMEOUT_MS,
      "Não foi possível atualizar este livro na biblioteca agora. Tente novamente.",
    );
    return;
  }

  await withDeadline(
    setDoc(
      ref,
      {
        title: book.title,
        author: book.author,
        cover: safeCover(book.cover),
        readerId: book.readerId ?? null,
        status,
        addedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    WRITE_TIMEOUT_MS,
    "Não foi possível adicionar este livro à biblioteca agora. Tente novamente.",
  );
  void awardXp(uid, 5);
}

/**
 * Called when a user opens a book in the reader. Upserts a library entry
 * with status "lendo" and the given `readerId` so it can be resumed later
 * from "Minha biblioteca" — this is what connects "reading" and "library"
 * into one flow. Never downgrades a book already marked "concluido". Fails
 * silently (logs only) — this runs automatically in the background and
 * shouldn't interrupt reading if it can't reach Firestore.
 */
export async function markAsReading(
  uid: string,
  book: { title: string; author: string; cover: string | null },
  readerId: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  try {
    const id = slugFor(book.title, book.author);
    const ref = doc(fb.db, "users", uid, "library", id);
    const existing = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null).catch(() => null);

    if (existing && existing.exists()) {
      const data = existing.data() as Partial<LibraryEntry>;
      const patch: Record<string, unknown> = {
        title: book.title,
        author: book.author,
        cover: safeCover(book.cover) ?? safeCover(data.cover as string | null | undefined),
        readerId,
      };
      if (data.status !== "concluido") patch.status = "lendo";
      await withDeadline(setDoc(ref, patch, { merge: true }), WRITE_TIMEOUT_MS, "timeout");
      return;
    }

    await withDeadline(
      setDoc(
        ref,
        {
          title: book.title,
          author: book.author,
          cover: safeCover(book.cover),
          readerId,
          status: "lendo",
          addedAt: serverTimestamp(),
        },
        { merge: true },
      ),
      WRITE_TIMEOUT_MS,
      "timeout",
    );
    void awardXp(uid, 5);
  } catch (err) {
    console.warn("[library] markAsReading failed (non-blocking)", err);
  }
}

export async function removeFromLibrary(uid: string, id: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  await withDeadline(
    deleteDoc(doc(fb.db, "users", uid, "library", id)),
    WRITE_TIMEOUT_MS,
    "Não foi possível remover este livro agora. Tente novamente.",
  );
}

export async function setLibraryStatus(
  uid: string,
  id: string,
  status: LibraryStatus,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  const ref = doc(fb.db, "users", uid, "library", id);

  const existing = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null).catch(() => null);
  const wasCompleted = !!existing && existing.exists() && existing.data().status === "concluido";

  await withDeadline(
    setDoc(ref, { status }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível atualizar o status deste livro agora. Tente novamente.",
  );

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
