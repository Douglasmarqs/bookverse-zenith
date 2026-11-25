/**
 * Light index of the books kept on this device (catalogue downloads and
 * personal imports). The books themselves live in IndexedDB; this small
 * list lets "Downloads e arquivos" show sizes and the storage breakdown
 * without deserialising every book.
 */
import { useSyncExternalStore } from "react";

export type DeviceKind = "epub" | "pdf" | "mobi" | "fb2" | "cbz" | "txt";

export interface DeviceBook {
  id: string;
  title: string;
  author: string;
  kind: DeviceKind;
  bytes: number;
  addedAt: number;
  /** "catalogo" for free downloads, "arquivo" for personal imports. */
  origin: "catalogo" | "arquivo";
  pages?: number;
}

const KEY = "bookverse:device-books";
const EVENT = "bookverse:device-books";
let cache: DeviceBook[] | null = null;

function read(): DeviceBook[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as DeviceBook[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: DeviceBook[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage full — the books are still in IndexedDB
  }
  window.dispatchEvent(new Event(EVENT));
}

export function rememberDeviceBook(book: DeviceBook) {
  write([book, ...read().filter((b) => b.id !== book.id)]);
}

export function forgetDeviceBook(id: string) {
  write(read().filter((b) => b.id !== id));
}

const EMPTY: DeviceBook[] = [];

export function useDeviceBooks(): DeviceBook[] {
  return useSyncExternalStore(
    (cb) => {
      const on = (e: Event) => {
        if (e.type === "storage") cache = null;
        cb();
      };
      window.addEventListener(EVENT, on);
      window.addEventListener("storage", on);
      return () => {
        window.removeEventListener(EVENT, on);
        window.removeEventListener("storage", on);
      };
    },
    read,
    () => EMPTY,
  );
}

export function formatBytes(n: number): string {
  if (n <= 0) return "0 KB";
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 * 1024) {
    const mb = n / 1024 ** 2;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
