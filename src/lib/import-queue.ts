/**
 * Import queue: several files at once, each converted in turn, with live
 * progress for "Adicionar livros" and "Downloads e arquivos".
 *
 * Signed-in readers also get a private cloud copy and a shelf entry;
 * guests keep the book on this device (it still opens offline).
 */
import { useSyncExternalStore } from "react";

import { getFirebase } from "./firebase";
import { convertFile, kindOf, type ImportKind } from "./importers";
import { rememberDeviceBook } from "./device-books";

export type ImportStatus = "waiting" | "working" | "done" | "error";

export interface ImportItem {
  id: string;
  /** Order the file was added in — the queue works oldest first. */
  seq: number;
  name: string;
  kind: ImportKind | null;
  bytes: number;
  status: ImportStatus;
  progress: number;
  stage: string;
  readerId?: string;
  title?: string;
  pages?: number;
  error?: string;
}

let items: ImportItem[] = [];
const listeners = new Set<() => void>();
const emit = () => {
  items = [...items];
  listeners.forEach((l) => l());
};
const patch = (id: string, p: Partial<ImportItem>) => {
  items = items.map((it) => (it.id === id ? { ...it, ...p } : it));
  listeners.forEach((l) => l());
};

export function useImportQueue(): ImportItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => items,
    () => items,
  );
}

export function clearFinishedImports() {
  items = items.filter((i) => i.status === "waiting" || i.status === "working");
  emit();
}

export function dismissImport(id: string) {
  items = items.filter((i) => i.id !== id);
  emit();
}

const files = new Map<string, File>();
let running = false;
let seq = 0;

/** Ask before closing the page while files are still being imported. */
function guardUnload(e: BeforeUnloadEvent) {
  if (items.some((i) => i.status === "working" || i.status === "waiting")) {
    e.preventDefault();
  }
}

/** Adds files to the queue and starts working through them. */
export function enqueueFiles(list: Iterable<File>): ImportItem[] {
  const added: ImportItem[] = [];
  for (const file of list) {
    const id = `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const kind = kindOf(file);
    const item: ImportItem = {
      id,
      seq: seq++,
      name: file.name,
      kind,
      bytes: file.size,
      status: kind ? "waiting" : "error",
      progress: 0,
      stage: kind ? "Na fila…" : "Formato não suportado",
      error: kind ? undefined : "Use EPUB, PDF, MOBI, AZW3, FB2, CBZ ou TXT.",
    };
    if (kind) files.set(id, file);
    added.push(item);
  }
  items = [...added, ...items];
  emit();
  void run();
  return added;
}

/** Eases the bar forward while a long step runs, never past `cap`. */
function creep(id: string, from: number, cap: number): () => void {
  let p = from;
  const t = window.setInterval(() => {
    p += (cap - p) * 0.08;
    patch(id, { progress: p });
  }, 220);
  return () => window.clearInterval(t);
}

async function run() {
  if (running) return;
  running = true;
  window.addEventListener("beforeunload", guardUnload);
  try {
    for (;;) {
      const next = items
        .filter((i) => i.status === "waiting")
        .reduce<ImportItem | null>((a, b) => (!a || b.seq < a.seq ? b : a), null);
      if (!next) break;
      await importOne(next.id);
    }
  } finally {
    running = false;
    window.removeEventListener("beforeunload", guardUnload);
  }
}

async function importOne(id: string) {
  const file = files.get(id);
  if (!file) return;
  patch(id, { status: "working", progress: 0.04, stage: "Lendo arquivo…" });
  let stop = creep(id, 0.04, 0.72);
  try {
    const converted = await convertFile(file, (stage) => patch(id, { stage }));
    stop();
    stop = creep(id, 0.75, 0.97);
    patch(id, { stage: "Salvando neste aparelho…" });
    const user = getFirebase()?.auth.currentUser;
    const member = user && !user.isAnonymous ? user : null;
    const { addToLibrary } = await import("./library");

    if (converted.type === "pdf") {
      const pdf = converted.pdf;
      const { savePdfBook, uploadPdfBookToCloud } = await import("./pdf-store");
      await savePdfBook(pdf);
      if (member) {
        patch(id, { stage: "Guardando na sua conta…" });
        try {
          await uploadPdfBookToCloud(member.uid, pdf);
          await addToLibrary(
            member.uid,
            { title: pdf.title, author: pdf.author, cover: pdf.cover ?? null, readerId: pdf.id },
            "lendo",
          );
        } catch {
          // The device copy still opens; the cloud copy syncs on the next open.
        }
      }
      rememberDeviceBook({
        id: pdf.id,
        title: pdf.title,
        author: pdf.author,
        kind: "pdf",
        bytes: file.size,
        addedAt: Date.now(),
        origin: "arquivo",
        pages: pdf.pageCount,
      });
      stop();
      patch(id, {
        status: "done",
        progress: 1,
        readerId: pdf.id,
        title: pdf.title,
        pages: pdf.pageCount,
        stage: pdf.readerBook
          ? `Pronto · ${pdf.pageCount} págs. com modo leitura`
          : `Pronto · ${pdf.pageCount} págs. (página original)`,
      });
    } else {
      const book = converted.book;
      const { saveEpubBook, uploadEpubBookToCloud } = await import("./epub-store");
      await saveEpubBook(book);
      if (member) {
        patch(id, { stage: "Guardando na sua conta…" });
        try {
          await uploadEpubBookToCloud(member.uid, book, file);
          await addToLibrary(
            member.uid,
            { title: book.title, author: book.author, cover: book.cover, readerId: book.id },
            "lendo",
          );
        } catch {
          // Same as above: the local copy is enough to read now.
        }
      }
      rememberDeviceBook({
        id: book.id,
        title: book.title,
        author: book.author,
        kind: kindOf(file) ?? "epub",
        bytes: file.size,
        addedAt: Date.now(),
        origin: "arquivo",
      });
      stop();
      const n = book.chapters.length;
      patch(id, {
        status: "done",
        progress: 1,
        readerId: book.id,
        title: book.title,
        stage: `Pronto · ${book.cover ? "capa e " : ""}${n} ${n === 1 ? "capítulo encontrado" : "capítulos encontrados"}`,
      });
    }
  } catch (err) {
    stop();
    patch(id, {
      status: "error",
      stage: "Não foi possível importar",
      error: err instanceof Error ? err.message : "Não foi possível importar este arquivo.",
    });
  } finally {
    files.delete(id);
  }
}

/* --------------------------- link import --------------------------- */

/** Turns share links from Drive/Dropbox/OneDrive into direct downloads. */
export function directLink(raw: string): string {
  const url = raw.trim();
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]{10,})/);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  if (/dropbox\.com\//.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set("dl", "1");
      return u.toString();
    } catch {
      return url;
    }
  }
  if (/1drv\.ms\/|onedrive\.live\.com\//.test(url) && !/download=1/.test(url)) {
    return `${url}${url.includes("?") ? "&" : "?"}download=1`;
  }
  return url;
}

/** Downloads a book from a link (through our server) and imports it. */
export async function importFromLink(raw: string): Promise<void> {
  const url = directLink(raw);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Cole um link completo, começando com https://");
  }
  if (parsed.protocol !== "https:") throw new Error("Use um link seguro (https://).");
  const r = await fetch(`/api/import/link?url=${encodeURIComponent(parsed.toString())}`);
  if (!r.ok) {
    const msg = await r
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new Error(msg || "Não foi possível baixar este link.");
  }
  const name =
    decodeURIComponent(r.headers.get("x-file-name") ?? "") ||
    decodeURIComponent(parsed.pathname.split("/").pop() || "livro");
  const blob = await r.blob();
  enqueueFiles([new File([blob], name, { type: blob.type })]);
}
