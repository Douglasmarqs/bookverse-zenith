/**
 * Private PDF imports. PDFs keep their original binary intact (unlike EPUBs,
 * which are parsed into reflowable chapters) and are mirrored to the same
 * account-only Firebase Storage area used by the EPUB importer.
 */
import { withDeadline } from "./async-utils";

const DB_NAME = "bookverse-pdf";
const STORE = "books";
const DB_VERSION = 1;
const CLOUD_ROOT = "pdfs";

export interface PdfBook {
  id: string;
  title: string;
  author: string;
  sourceName: string;
  sourceSize: number;
  source: Blob;
  createdAt: number;
}

type PdfMetadata = Omit<PdfBook, "source">;

const memoryBooks = new Map<string, PdfBook>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não está disponível neste navegador."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha ao abrir o armazenamento local."));
  });
}

function safePdfName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 160) || "livro.pdf";
}

function storagePath(uid: string, id: string, file: "book.json" | "source.pdf") {
  return `users/${uid}/${CLOUD_ROOT}/${id}/${file}`;
}

function metadataPath(uid: string, id: string) {
  return ["users", uid, "pdfFiles", id] as const;
}

export function newPdfId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `pdf-${Date.now()}-${random}`;
}

export function isPdfReaderId(bookId: string): boolean {
  return bookId.startsWith("pdf-");
}

export function createPdfBook(file: File): PdfBook {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Envie um arquivo .pdf válido.");
  }
  if (file.size > 60 * 1024 * 1024) {
    throw new Error("O PDF precisa ter no máximo 60 MB.");
  }
  return {
    id: newPdfId(),
    title: file.name.replace(/\.pdf$/i, "").trim() || "Documento PDF",
    author: "Documento pessoal",
    sourceName: safePdfName(file.name),
    sourceSize: file.size,
    source: file,
    createdAt: Date.now(),
  };
}

export async function savePdfBook(book: PdfBook): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(book);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Falha ao salvar o PDF localmente."));
  });
  db.close();
  memoryBooks.set(book.id, book);
}

export async function getPdfBook(id: string): Promise<PdfBook | null> {
  const cached = memoryBooks.get(id);
  if (cached) return cached;
  const db = await openDb();
  const result = await new Promise<PdfBook | null>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as PdfBook | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha ao ler o PDF deste aparelho."));
  });
  db.close();
  if (result) memoryBooks.set(id, result);
  return result;
}

export async function deletePdfBook(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Falha ao remover o PDF deste aparelho."));
  });
  db.close();
  memoryBooks.delete(id);
}

export async function uploadPdfBookToCloud(uid: string, book: PdfBook): Promise<void> {
  const { getFirebase } = await import("./firebase");
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase não está configurado neste ambiente.");

  const { ref, uploadBytes } = await import("firebase/storage");
  const { doc, setDoc } = await import("firebase/firestore");
  const metadata: PdfMetadata = {
    id: book.id,
    title: book.title,
    author: book.author,
    sourceName: book.sourceName,
    sourceSize: book.sourceSize,
    createdAt: book.createdAt,
  };

  await uploadBytes(ref(firebase.storage, storagePath(uid, book.id, "source.pdf")), book.source, {
    contentType: "application/pdf",
    customMetadata: { originalName: book.sourceName, bookId: book.id, kind: "source-pdf" },
  });
  await uploadBytes(
    ref(firebase.storage, storagePath(uid, book.id, "book.json")),
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    { contentType: "application/json", customMetadata: { bookId: book.id, kind: "pdf-metadata" } },
  );
  await setDoc(doc(firebase.db, ...metadataPath(uid, book.id)), {
    storageVersion: 1,
    ...metadata,
    updatedAt: Date.now(),
  });
}

export async function downloadPdfBookFromCloud(uid: string, id: string): Promise<PdfBook | null> {
  const cached = memoryBooks.get(id);
  if (cached) return cached;
  const { getFirebase } = await import("./firebase");
  const firebase = getFirebase();
  if (!firebase) return null;

  try {
    const { getBytes, ref } = await import("firebase/storage");
    const { doc, getDoc } = await import("firebase/firestore");
    const [metaSnapshot, source, json] = await Promise.all([
      getDoc(doc(firebase.db, ...metadataPath(uid, id))),
      withDeadline(
        getBytes(ref(firebase.storage, storagePath(uid, id, "source.pdf")), 60 * 1024 * 1024),
        20_000,
        "timeout",
      ),
      withDeadline(
        getBytes(ref(firebase.storage, storagePath(uid, id, "book.json")), 256 * 1024),
        8_000,
        "timeout",
      ),
    ]);
    const metadata = JSON.parse(new TextDecoder().decode(json)) as PdfMetadata;
    if (!metaSnapshot.exists() || metadata.id !== id) return null;
    const book: PdfBook = { ...metadata, source: new Blob([source], { type: "application/pdf" }) };
    memoryBooks.set(id, book);
    return book;
  } catch (error) {
    console.warn("[pdf] cloud download failed", error);
    return null;
  }
}

export async function deletePdfBookFromCloud(uid: string, id: string): Promise<void> {
  const { getFirebase } = await import("./firebase");
  const firebase = getFirebase();
  if (!firebase) throw new Error("Firebase não está configurado neste ambiente.");
  const { deleteObject, ref } = await import("firebase/storage");
  const { deleteDoc, doc } = await import("firebase/firestore");
  const removed = await Promise.allSettled([
    deleteObject(ref(firebase.storage, storagePath(uid, id, "source.pdf"))),
    deleteObject(ref(firebase.storage, storagePath(uid, id, "book.json"))),
  ]);
  const failure = removed.find(
    (result) =>
      result.status === "rejected" &&
      (result.reason as { code?: string })?.code !== "storage/object-not-found",
  );
  if (failure?.status === "rejected") throw failure.reason;
  await deleteDoc(doc(firebase.db, ...metadataPath(uid, id)));
}
