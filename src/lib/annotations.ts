/**
 * Reading annotations — highlights (with optional notes) and bookmarks.
 * Stored one document per book at `users/{uid}/annotations/{bookId}` so a
 * single read/subscribe gets everything for the book currently open.
 */
import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "./firebase";
import { withDeadline, withFallback } from "./async-utils";

export type HighlightColor = "gold" | "green" | "blue" | "pink";

export interface Highlight {
  id: string;
  chapterId: string;
  chapterIndex: number;
  paragraphIndex: number;
  color: HighlightColor;
  note?: string;
  /** First ~140 chars of the paragraph — shown in the "Destaques" list so
   * it doesn't need to re-fetch the book text to render an overview. */
  excerpt: string;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  chapterId: string;
  chapterIndex: number;
  scrollRatio: number;
  label: string;
  createdAt: number;
}

export interface BookAnnotations {
  highlights: Highlight[];
  bookmarks: Bookmark[];
}

const EMPTY: BookAnnotations = { highlights: [], bookmarks: [] };
const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 10000;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ref(uid: string, bookId: string) {
  const fb = getFirebase();
  if (!fb) return null;
  return doc(fb.db, "users", uid, "annotations", bookId);
}

export function subscribeAnnotations(
  uid: string,
  bookId: string,
  cb: (data: BookAnnotations) => void,
): Unsubscribe {
  const r = ref(uid, bookId);
  if (!r) {
    cb(EMPTY);
    return () => {};
  }
  return onSnapshot(
    r,
    (snap) => {
      const data = snap.data() as Partial<BookAnnotations> | undefined;
      cb({ highlights: data?.highlights ?? [], bookmarks: data?.bookmarks ?? [] });
    },
    (err) => {
      console.warn("[annotations] subscribe failed", err);
      cb(EMPTY);
    },
  );
}

async function readCurrent(uid: string, bookId: string): Promise<BookAnnotations> {
  const r = ref(uid, bookId);
  if (!r) return EMPTY;
  const snap = await withFallback(getDoc(r), READ_TIMEOUT_MS, null).catch(() => null);
  const data = snap?.data() as Partial<BookAnnotations> | undefined;
  return { highlights: data?.highlights ?? [], bookmarks: data?.bookmarks ?? [] };
}

export async function addHighlight(
  uid: string,
  bookId: string,
  entry: Omit<Highlight, "id" | "createdAt">,
): Promise<Highlight> {
  const r = ref(uid, bookId);
  if (!r) throw new Error("O login não está disponível neste ambiente agora.");
  const highlight: Highlight = { ...entry, id: newId(), createdAt: Date.now() };
  const current = await readCurrent(uid, bookId);
  await withDeadline(
    setDoc(r, { highlights: [...current.highlights, highlight] }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível salvar o destaque agora. Tente novamente.",
  );
  return highlight;
}

export async function updateHighlightNote(
  uid: string,
  bookId: string,
  highlightId: string,
  note: string,
): Promise<void> {
  const r = ref(uid, bookId);
  if (!r) throw new Error("O login não está disponível neste ambiente agora.");
  const current = await readCurrent(uid, bookId);
  const highlights = current.highlights.map((h) => (h.id === highlightId ? { ...h, note } : h));
  await withDeadline(
    setDoc(r, { highlights }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível salvar a anotação agora. Tente novamente.",
  );
}

export async function removeHighlight(
  uid: string,
  bookId: string,
  highlightId: string,
): Promise<void> {
  const r = ref(uid, bookId);
  if (!r) throw new Error("O login não está disponível neste ambiente agora.");
  const current = await readCurrent(uid, bookId);
  const highlights = current.highlights.filter((h) => h.id !== highlightId);
  await withDeadline(
    setDoc(r, { highlights }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível remover o destaque agora. Tente novamente.",
  );
}

export async function addBookmark(
  uid: string,
  bookId: string,
  entry: Omit<Bookmark, "id" | "createdAt">,
): Promise<Bookmark> {
  const r = ref(uid, bookId);
  if (!r) throw new Error("O login não está disponível neste ambiente agora.");
  const bookmark: Bookmark = { ...entry, id: newId(), createdAt: Date.now() };
  const current = await readCurrent(uid, bookId);
  await withDeadline(
    setDoc(r, { bookmarks: [...current.bookmarks, bookmark] }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível salvar o marcador agora. Tente novamente.",
  );
  return bookmark;
}

export async function removeBookmark(
  uid: string,
  bookId: string,
  bookmarkId: string,
): Promise<void> {
  const r = ref(uid, bookId);
  if (!r) throw new Error("O login não está disponível neste ambiente agora.");
  const current = await readCurrent(uid, bookId);
  const bookmarks = current.bookmarks.filter((b) => b.id !== bookmarkId);
  await withDeadline(
    setDoc(r, { bookmarks }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível remover o marcador agora. Tente novamente.",
  );
}
