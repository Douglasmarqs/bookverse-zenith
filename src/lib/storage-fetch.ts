/** Downloads of private Firebase Storage files with progress and stall
 * detection (shared by EPUB and PDF cloud copies). */
import { withDeadline } from "./async-utils";

/** Thrown when nothing arrives for a while — the network is stuck, not slow. */
export class StalledError extends Error {}

/**
 * Streams a private Storage object with progress. Unlike getBytes (which
 * retries silently for minutes on a bad network), a download that is
 * moving is never cut short, and one that stops receiving data for
 * `stallMs` fails fast so the next option can be tried.
 */
export async function fetchStorageFile(
  path: string,
  onBytes: (loaded: number, total: number) => void,
  stallMs = 20_000,
): Promise<Uint8Array<ArrayBuffer>> {
  const { getFirebase } = await import("./firebase");
  const fb = getFirebase();
  if (!fb) throw new Error("no-firebase");
  const { getDownloadURL, ref } = await import("firebase/storage");
  const url = await withDeadline(getDownloadURL(ref(fb.storage, path)), stallMs, "stalled");
  return fetchWithStall(url, onBytes, stallMs);
}

/** Downloads `url` with progress; aborts only if no data arrives for
 * `stallMs` (a slow but moving download is never cut short). */
export async function fetchWithStall(
  url: string,
  onBytes: (loaded: number, total: number) => void,
  stallMs = 20_000,
): Promise<Uint8Array<ArrayBuffer>> {
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), stallMs);
  const kick = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), stallMs);
  };
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`http-${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body) {
      const buf = new Uint8Array(await res.arrayBuffer());
      onBytes(buf.length, total || buf.length);
      return buf;
    }
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let loaded = 0;
    onBytes(0, total);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      kick();
      parts.push(value);
      loaded += value.length;
      onBytes(loaded, total);
    }
    const out = new Uint8Array(loaded);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  } catch (err) {
    if (ctrl.signal.aborted) throw new StalledError("stalled");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
