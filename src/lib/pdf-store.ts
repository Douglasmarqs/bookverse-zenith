/**
 * Private PDF imports. PDFs keep their original binary intact (unlike EPUBs,
 * which are parsed into reflowable chapters) and are mirrored to the same
 * account-only Firebase Storage area used by the EPUB importer.
 */
import { retryTransient, withDeadline } from "./async-utils";
import type { Book } from "./sample-book";

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
  /** Reflowable text extracted from PDFs that expose a text layer. */
  readerBook: Book | null;
  pageCount: number;
  textLayerStatus: "ready" | "unavailable";
  createdAt: number;
}

type PdfMetadata = Omit<PdfBook, "source" | "readerBook"> & {
  hasTextLayer: boolean;
};

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

function storagePath(uid: string, id: string, file: "book.json" | "reader.json" | "source.pdf") {
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

function linesToParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let buffer = "";
  for (const line of lines) {
    buffer = buffer ? `${buffer} ${line}` : line;
    if (/[.!?…]["”')\]]?$/.test(buffer) || buffer.length >= 650) {
      paragraphs.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer.trim()) paragraphs.push(buffer.trim());
  return paragraphs;
}

async function extractPdfText(
  file: Blob,
  id: string,
  title: string,
): Promise<{
  readerBook: Book | null;
  pageCount: number;
}> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    }
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise;
    const chapters: Book["chapters"] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let current = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const value = item.str.trim();
        const y = item.transform[5] ?? 0;
        const newLine = lastY !== null && Math.abs(y - lastY) > 3;
        if (newLine && current.trim()) {
          lines.push(current.replace(/\s+/g, " ").trim());
          current = "";
        }
        if (value) current += `${current ? " " : ""}${value}`;
        if (item.hasEOL && current.trim()) {
          lines.push(current.replace(/\s+/g, " ").trim());
          current = "";
        }
        lastY = y;
      }
      if (current.trim()) lines.push(current.replace(/\s+/g, " ").trim());
      const paragraphs = linesToParagraphs(lines).filter((text) => text.length > 1);
      if (paragraphs.length) {
        chapters.push({ id: `pagina-${pageNumber}`, title: `Página ${pageNumber}`, paragraphs });
      }
    }

    const pageCount = pdf.numPages;
    await pdf.destroy();
    if (!chapters.length) return { readerBook: null, pageCount };
    return {
      readerBook: { id, title, author: "Documento pessoal", cover: null, chapters },
      pageCount,
    };
  } catch (error) {
    console.warn("[pdf] text extraction unavailable; using original-layout viewer", error);
    return { readerBook: null, pageCount: 0 };
  }
}

export async function createPdfBook(file: File): Promise<PdfBook> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Envie um arquivo .pdf válido.");
  }
  if (file.size > 60 * 1024 * 1024) {
    throw new Error("O PDF precisa ter no máximo 60 MB.");
  }
  const id = newPdfId();
  const title = file.name.replace(/\.pdf$/i, "").trim() || "Documento PDF";
  const extracted = await extractPdfText(file, id, title);
  return {
    id,
    title,
    author: "Documento pessoal",
    sourceName: safePdfName(file.name),
    sourceSize: file.size,
    source: file,
    readerBook: extracted.readerBook,
    pageCount: extracted.pageCount,
    textLayerStatus: extracted.readerBook ? "ready" : "unavailable",
    createdAt: Date.now(),
  };
}

export async function ensurePdfBookText(book: PdfBook): Promise<PdfBook> {
  if (book.readerBook || book.textLayerStatus === "unavailable") return book;
  const extracted = await extractPdfText(book.source, book.id, book.title);
  return {
    ...book,
    readerBook: extracted.readerBook,
    pageCount: extracted.pageCount,
    textLayerStatus: extracted.readerBook ? "ready" : "unavailable",
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
    pageCount: book.pageCount,
    hasTextLayer: Boolean(book.readerBook),
    textLayerStatus: book.textLayerStatus,
    createdAt: book.createdAt,
  };

  await retryTransient(() =>
    uploadBytes(ref(firebase.storage, storagePath(uid, book.id, "source.pdf")), book.source, {
      contentType: "application/pdf",
      customMetadata: { originalName: book.sourceName, bookId: book.id, kind: "source-pdf" },
    }),
  );
  await retryTransient(() =>
    uploadBytes(
      ref(firebase.storage, storagePath(uid, book.id, "book.json")),
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
      {
        contentType: "application/json",
        customMetadata: { bookId: book.id, kind: "pdf-metadata" },
      },
    ),
  );
  if (book.readerBook) {
    await retryTransient(() =>
      uploadBytes(
        ref(firebase.storage, storagePath(uid, book.id, "reader.json")),
        new Blob([JSON.stringify(book.readerBook)], { type: "application/json" }),
        {
          contentType: "application/json",
          customMetadata: { bookId: book.id, kind: "pdf-text" },
        },
      ),
    );
  }
  await retryTransient(() =>
    setDoc(doc(firebase.db, ...metadataPath(uid, book.id)), {
      storageVersion: 1,
      ...metadata,
      updatedAt: Date.now(),
    }),
  );
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
    const [metaSnapshot, json] = await Promise.all([
      getDoc(doc(firebase.db, ...metadataPath(uid, id))),
      withDeadline(
        getBytes(ref(firebase.storage, storagePath(uid, id, "book.json")), 256 * 1024),
        20_000,
        "timeout",
      ),
    ]);
    const metadata = JSON.parse(new TextDecoder().decode(json)) as PdfMetadata;
    if (!metaSnapshot.exists() || metadata.id !== id) return null;
    const [source, readerBook] = await Promise.all([
      withDeadline(
        getBytes(ref(firebase.storage, storagePath(uid, id, "source.pdf")), 64 * 1024 * 1024),
        90_000,
        "timeout",
      ),
      metadata.hasTextLayer
        ? withDeadline(
            getBytes(ref(firebase.storage, storagePath(uid, id, "reader.json")), 24 * 1024 * 1024),
            60_000,
            "timeout",
          )
            .then((bytes) => JSON.parse(new TextDecoder().decode(bytes)) as Book)
            .catch((error) => {
              console.warn("[pdf] reflowable cloud copy unavailable", error);
              return null;
            })
        : Promise.resolve(null),
    ]);
    const book: PdfBook = {
      id: metadata.id,
      title: metadata.title,
      author: metadata.author,
      sourceName: metadata.sourceName,
      sourceSize: metadata.sourceSize,
      createdAt: metadata.createdAt,
      pageCount: metadata.pageCount ?? 0,
      readerBook,
      textLayerStatus: readerBook ? "ready" : (metadata.textLayerStatus ?? "unavailable"),
      source: new Blob([source], { type: "application/pdf" }),
    };
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
    deleteObject(ref(firebase.storage, storagePath(uid, id, "reader.json"))),
  ]);
  const failure = removed.find(
    (result) =>
      result.status === "rejected" &&
      (result.reason as { code?: string })?.code !== "storage/object-not-found",
  );
  if (failure?.status === "rejected") throw failure.reason;
  await deleteDoc(doc(firebase.db, ...metadataPath(uid, id)));
}
