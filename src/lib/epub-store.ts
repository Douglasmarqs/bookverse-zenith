/**
 * Local storage for user-uploaded EPUB books.
 *
 * IndexedDB is an offline cache, never the source of truth. A durable copy
 * belongs in the authenticated person's private Firebase Storage folder so
 * it can be opened on another device.
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
 * Cloud copy (Firebase Storage)
 *
 * IndexedDB is deliberately only an offline cache. The parsed content and
 * the original EPUB are stored under the authenticated owner's Storage
 * prefix, allowing a reader to open their book on another device without
 * trusting Firestore documents to carry large file payloads. The legacy
 * Firestore reader remains as a one-way compatibility fallback for books
 * imported before this migration.
 * ------------------------------------------------------------------ */

const CLOUD_ROOT = "epubs";

function storagePath(uid: string, id: string, filename: "book.json" | "source.epub") {
  return `users/${uid}/${CLOUD_ROOT}/${id}/${filename}`;
}

function metadataPath(uid: string, id: string) {
  return ["users", uid, "epubFiles", id] as const;
}

function safeEpubName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 160) || "livro.epub";
}

/**
 * Persists both a device-ready parsed representation and the original EPUB.
 * Callers should await this function: claiming an EPUB is synced before
 * Storage accepts it would create a broken cross-device library entry.
 */
export async function uploadEpubBookToCloud(uid: string, book: Book, source: File): Promise<void> {
  const { getFirebase } = await import("./firebase");
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase não está configurado neste ambiente.");

  const { ref, uploadBytes } = await import("firebase/storage");
  const { doc, setDoc } = await import("firebase/firestore");
  const json = JSON.stringify(book);
  const parsed = new Blob([json], { type: "application/json" });

  // Upload the original first. A parsed representation without its source
  // makes recovery impossible if the parser evolves; metadata is only
  // published after both private Storage objects have landed successfully.
  await uploadBytes(ref(fb.storage, storagePath(uid, book.id, "source.epub")), source, {
    // Browsers commonly report EPUBs as application/octet-stream (or an
    // empty type). The object is still known to be an EPUB because parsing
    // above succeeded; use the canonical type so Storage rules can enforce
    // the allowed object shape consistently.
    contentType: "application/epub+zip",
    customMetadata: {
      originalName: safeEpubName(source.name),
      bookId: book.id,
      kind: "source-epub",
    },
  });
  await uploadBytes(ref(fb.storage, storagePath(uid, book.id, "book.json")), parsed, {
    contentType: "application/json",
    customMetadata: { bookId: book.id, kind: "parsed-book" },
  });

  await setDoc(doc(fb.db, ...metadataPath(uid, book.id)), {
    storageVersion: 1,
    title: book.title,
    author: book.author,
    chapterCount: book.chapters.length,
    sourceName: safeEpubName(source.name),
    sourceSize: source.size,
    updatedAt: Date.now(),
  });
}

async function downloadLegacyEpubBook(uid: string, id: string): Promise<Book | null> {
  const { getFirebase } = await import("./firebase");
  const fb = getFirebase();
  if (!fb) return null;
  const { doc, getDoc } = await import("firebase/firestore");
  const metaSnap = await getDoc(doc(fb.db, ...metadataPath(uid, id)));
  if (!metaSnap.exists()) return null;
  const total = Number((metaSnap.data() as { chunks?: number }).chunks ?? 0);
  if (!total) return null;
  const parts = await Promise.all(
    Array.from({ length: total }, (_, i) =>
      getDoc(doc(fb.db, "users", uid, "epubFiles", id, "chunks", String(i))),
    ),
  );
  const json = parts.reduce((text, part) => {
    if (!part.exists()) throw new Error("Uma parte do EPUB legado não está disponível.");
    return text + ((part.data() as { data?: string }).data ?? "");
  }, "");
  return JSON.parse(json) as Book;
}

export async function downloadEpubBookFromCloud(uid: string, id: string): Promise<Book | null> {
  const { getFirebase } = await import("./firebase");
  const fb = getFirebase();
  if (!fb) return null;
  try {
    const { getBytes, ref } = await import("firebase/storage");
    // Firebase's default download ceiling is only 10 MB. Illustrated EPUBs
    // legitimately exceed that once parsed, while import intentionally caps
    // source files at 60 MB.
    const bytes = await getBytes(
      ref(fb.storage, storagePath(uid, id, "book.json")),
      80 * 1024 * 1024,
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as Book;
  } catch (storageError) {
    try {
      const legacy = await downloadLegacyEpubBook(uid, id);
      if (legacy) return legacy;
    } catch (legacyError) {
      console.warn("[epub] legacy cloud download failed", legacyError);
    }
    console.warn("[epub] storage download failed", storageError);
    return null;
  }
}

/** Removes the durable cloud copy. Local cache removal remains explicit. */
export async function deleteEpubBookFromCloud(uid: string, id: string): Promise<void> {
  const { getFirebase } = await import("./firebase");
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase não está configurado neste ambiente.");
  const { deleteObject, ref } = await import("firebase/storage");
  const { collection, deleteDoc, doc, getDocs } = await import("firebase/firestore");

  const results = await Promise.allSettled([
    deleteObject(ref(fb.storage, storagePath(uid, id, "book.json"))),
    deleteObject(ref(fb.storage, storagePath(uid, id, "source.epub"))),
  ]);
  const meaningfulFailure = results.find(
    (result) =>
      result.status === "rejected" &&
      (result.reason as { code?: string })?.code !== "storage/object-not-found",
  );
  if (meaningfulFailure?.status === "rejected") throw meaningfulFailure.reason;

  const chunks = await getDocs(collection(fb.db, "users", uid, "epubFiles", id, "chunks"));
  await Promise.all(chunks.docs.map((chunk) => deleteDoc(chunk.ref)));
  await deleteDoc(doc(fb.db, ...metadataPath(uid, id)));
}
