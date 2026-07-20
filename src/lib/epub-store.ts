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
