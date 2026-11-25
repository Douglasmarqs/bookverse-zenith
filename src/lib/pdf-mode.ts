/**
 * How PDFs open: "leitura" reflows the extracted text (fonts, sizes, page
 * turns like an EPUB); "original" shows the PDF's own pages. Scanned PDFs
 * without a text layer always use the original pages.
 */
import { useSyncExternalStore } from "react";

export type PdfMode = "leitura" | "original";

const KEY = "bookverse:pdf-mode";
const EVENT = "bookverse:pdf-mode";

export function getPdfMode(): PdfMode {
  try {
    return localStorage.getItem(KEY) === "original" ? "original" : "leitura";
  } catch {
    return "leitura";
  }
}

export function setPdfMode(mode: PdfMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePdfMode(): PdfMode {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    getPdfMode,
    () => "leitura" as PdfMode,
  );
}
