/** Account-scoped device cache. The legacy store is retained until ownership
 * can be confirmed online; merely knowing a book ID never grants access. */
export function privateBookKey(uid: string, id: string): string {
  if (!uid || !id) throw new Error("Uma conta e um livro são necessários.");
  return JSON.stringify([uid, id]);
}

function openCache(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
      if (!db.objectStoreNames.contains("accountBooks")) db.createObjectStore("accountBooks");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function writePrivateBook<T>(name: string, uid: string, id: string, book: T | null) {
  const key = privateBookKey(uid, id);
  const db = await openCache(name);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("accountBooks", "readwrite");
      if (book === null) tx.objectStore("accountBooks").delete(key);
      else tx.objectStore("accountBooks").put(book, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readPrivateBook<T>(
  name: string,
  uid: string,
  id: string,
  confirmLegacyOwner: () => Promise<boolean>,
): Promise<T | null> {
  const key = privateBookKey(uid, id);
  const db = await openCache(name);
  let legacy: T | null;
  try {
    const current = await read<T>(db, "accountBooks", key);
    if (current) return current;
    legacy = await read<T>(db, "books", id);
  } finally {
    db.close();
  }
  if (!legacy || !(await confirmLegacyOwner().catch(() => false))) return null;
  await writePrivateBook(name, uid, id, legacy);
  return legacy;
}

export async function confirmPrivateBookOwner(
  uid: string,
  id: string,
  kind: "epubFiles" | "pdfFiles",
) {
  const { getFirebase } = await import("./firebase-services");
  const fb = getFirebase();
  if (!fb || fb.auth.currentUser?.uid !== uid) return false;
  const { doc, getDocFromServer } = await import("firebase/firestore");
  return (await getDocFromServer(doc(fb.db, "users", uid, kind, id))).exists();
}
