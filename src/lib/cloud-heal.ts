/**
 * Self-healing cloud copies. A personal EPUB/PDF that this device has but
 * the account's cloud doesn't (the upload after import was interrupted —
 * common on phones) is sent again, quietly, the next time the book is
 * opened or shown on the shelf. That's what makes it open on the reader's
 * other devices (on iPhone, the home-screen app and Safari don't share
 * storage either).
 */
import { epubCloudCopyExists, getEpubBook, uploadParsedEpubBook } from "./epub-store";
import { getPdfBook, pdfCloudCopyExists, uploadPdfBookToCloud } from "./pdf-store";

const checked = new Set<string>();
const SESSION_KEY = "bookverse:cloud-checked";

function seen(id: string): boolean {
  if (checked.has(id)) return true;
  try {
    const list = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
    if (list.includes(id)) return true;
  } catch {
    // storage unavailable
  }
  return false;
}

function remember(id: string) {
  checked.add(id);
  try {
    const list = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...list, id].slice(-300)));
  } catch {
    // storage unavailable
  }
}

/** Makes sure the cloud has this book, uploading it from this device if
 * not. Safe to call often: checks once per book per session. */
export async function ensureBookInCloud(uid: string, readerId: string): Promise<void> {
  if (!uid || seen(readerId)) return;
  const isEpub = readerId.startsWith("epub-");
  const isPdf = readerId.startsWith("pdf-");
  if (!isEpub && !isPdf) return;
  checked.add(readerId);
  try {
    const exists = isEpub
      ? await epubCloudCopyExists(uid, readerId)
      : await pdfCloudCopyExists(uid, readerId);
    if (exists === null) {
      checked.delete(readerId); // unknown (offline…): try again later
      return;
    }
    if (exists) return remember(readerId);
    if (isEpub) {
      const book = await getEpubBook(readerId);
      if (book) await uploadParsedEpubBook(uid, book);
    } else {
      const pdf = await getPdfBook(readerId);
      if (pdf) await uploadPdfBookToCloud(uid, pdf);
    }
    remember(readerId);
  } catch (err) {
    checked.delete(readerId);
    console.warn("[cloud-heal]", readerId, err);
  }
}

/** One at a time, in the background, for a list of books. */
export async function ensureBooksInCloud(uid: string, readerIds: string[]): Promise<void> {
  for (const id of readerIds) await ensureBookInCloud(uid, id);
}
