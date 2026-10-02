import { readPrivateBook, writePrivateBook } from "../../src/lib/private-book-cache.ts";
import { saveEpubBook, getEpubBook, deleteEpubBook } from "../../src/lib/epub-store.ts";
import { savePdfBook, getPdfBook, deletePdfBook } from "../../src/lib/pdf-store.ts";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/** Browser-only regression: real IndexedDB and the production memory caches. */
export async function runPrivateCacheChecks() {
  const id = `cache-qa-${crypto.randomUUID()}`;
  const name = `bookverse-test-${id}`;
  const original = { id, title: "Private test", chapters: [] };
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("books", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction("books", "readwrite");
    tx.objectStore("books").put(original);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  try {
    expect(
      (await readPrivateBook(name, "other", id, async () => false)) === null,
      "Legacy book leaked without ownership",
    );
    expect(
      (await readPrivateBook(name, "offline", id, async () => {
        throw new Error("offline");
      })) === null,
      "Offline legacy book adopted without verification",
    );
    expect(
      (await readPrivateBook(name, "owner", id, async () => true))?.title === original.title,
      "Verified legacy copy not migrated",
    );
    expect(
      (
        await readPrivateBook(name, "owner", id, async () => {
          throw new Error("offline");
        })
      )?.title === original.title,
      "Migrated copy unavailable offline",
    );
    await writePrivateBook(name, "other", id, { ...original, title: "Other account" });
    await writePrivateBook(name, "other", id, null);
    expect(
      (await readPrivateBook(name, "owner", id, async () => false))?.title === original.title,
      "One account deleted another account's cache",
    );
    for (const [save, get, remove, book] of [
      [saveEpubBook, getEpubBook, deleteEpubBook, original],
      [
        savePdfBook,
        getPdfBook,
        deletePdfBook,
        { ...original, source: new Blob(["fixture"], { type: "application/pdf" }) },
      ],
    ]) {
      await save("cache-owner", book);
      expect((await get("cache-owner", id))?.title === original.title, "Owner cache missing");
      expect(
        (await get("cache-other", id)) === null,
        "Private memory cache leaked between accounts",
      );
      await remove("cache-owner", id);
    }
    return [
      "Legacy owner validation",
      "Verified migration and offline recovery",
      "Deletion isolation",
      "EPUB/PDF memory and IndexedDB account isolation",
    ];
  } finally {
    indexedDB.deleteDatabase(name);
  }
}
