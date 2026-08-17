/**
 * Local storage for user-uploaded EPUB books.
 *
 * These are the user's own files — there's no server-side component and no
 * Firebase Storage/Cloud Function involved, so this works with zero extra
 * deployment. The trade-off is that an uploaded EPUB is only available on
 * the browser/device it was uploaded from (not synced across devices) —
 * "Minha biblioteca" still tracks the *entry* (title/author/cover) across
 * devices via Firestore as usual, but opening it to read only works where
 * the file was actually parsed and stored.
 */
import type { Book } from "./sample-book";

const DB_NAME = "bookverse-epub";
const STORE = "books";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não está disponível neste navegador."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o armazenamento local."));
  });
}

export function newEpubId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `epub-${Date.now()}-${rand}`;
}

export function isEpubReaderId(bookId: string): boolean {
  return bookId.startsWith("epub-");
}

export async function saveEpubBook(book: Book): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(book);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar o livro localmente."));
  });
  db.close();
}

export async function getEpubBook(id: string): Promise<Book | null> {
  const db = await openDb();
  const result = await new Promise<Book | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Book | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Falha ao ler o livro local."));
  });
  db.close();
  return result;
}

export async function deleteEpubBook(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao remover o livro local."));
  });
  db.close();
}

/* ------------------------------------------------------------------ *
 * Cloud copy (Firestore, chunked)
 *
 * An imported EPUB lives in IndexedDB on the device it was imported
 * from. To let the same book open on another device, we also store the
 * parsed book as JSON split into chunks under
 * `users/{uid}/epubFiles/{bookId}` + `.../chunks/{n}` — Firestore caps a
 * single document at ~1MB, so a book must be split. Books above the
 * ceiling below stay local-only (still perfectly readable there).
 * ------------------------------------------------------------------ */

const CHUNK_SIZE = 400_000; // characters, comfortably under the 1MB doc cap
const MAX_CLOUD_CHARS = 6_000_000; // ~6MB of JSON — bigger books stay local

export async function uploadEpubBookToCloud(uid: string, book: Book): Promise<boolean> {
  const { getFirebase } = await import("./firebase");
  const fb = getFirebase();
  if (!fb) return false;
  const json = JSON.stringify(book);
  if (json.length > MAX_CLOUD_CHARS) return false;

  const { doc, setDoc } = await import("firebase/firestore");
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK_SIZE) chunks.push(json.slice(i, i + CHUNK_SIZE));

  try {
    await Promise.all(
      chunks.map((data, i) =>
        setDoc(doc(fb.db, "users", uid, "epubFiles", book.id, "chunks", String(i)), { data }),
      ),
    );
    await setDoc(doc(fb.db, "users", uid, "epubFiles", book.id), {
      chunks: chunks.length,
      title: book.title,
      author: book.author,
      updatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn("[epub] cloud upload failed (book stays local)", err);
    return false;
  }
}

export async function downloadEpubBookFromCloud(uid: string, id: string): Promise<Book | null> {
  const { getFirebase } = await import("./firebase");
  const fb = getFirebase();
  if (!fb) return null;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const metaSnap = await getDoc(doc(fb.db, "users", uid, "epubFiles", id));
    if (!metaSnap.exists()) return null;
    const total = Number((metaSnap.data() as { chunks?: number }).chunks ?? 0);
    if (!total) return null;
    const parts = await Promise.all(
      Array.from({ length: total }, (_, i) =>
        getDoc(doc(fb.db, "users", uid, "epubFiles", id, "chunks", String(i))),
      ),
    );
    let json = "";
    for (const part of parts) {
      if (!part.exists()) return null;
      json += (part.data() as { data?: string }).data ?? "";
    }
    return JSON.parse(json) as Book;
  } catch (err) {
    console.warn("[epub] cloud download failed", err);
    return null;
  }
}
