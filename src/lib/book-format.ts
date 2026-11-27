/** What kind of book a shelf item is — file format and where it came
 * from — for the labels on the library's books. */
import type { DeviceKind } from "./device-books";

export interface BookFormat {
  /** Short label on the book: EPUB, PDF… */
  label: string;
  /** Where it came from, in plain words. */
  origin: string;
  tone: string;
}

const FORMAT_TONE: Record<string, string> = {
  EPUB: "#1f7a6d",
  PDF: "#c2412d",
  MOBI: "#6b4fa0",
  FB2: "#8a5a1f",
  CBZ: "#b7791f",
  TXT: "#5b6270",
  ONLINE: "#3a5f9e",
  SALVO: "#7a7368",
};

/** What kind of book this is, from its file on this device or its id. */
export function bookFormat(b: {
  readerId?: string | null;
  device?: { kind: DeviceKind; origin: "catalogo" | "arquivo" };
}): BookFormat {
  const id = b.readerId ?? "";
  const kind = b.device?.kind;
  const fromFile = b.device?.origin === "arquivo";
  let label: string;
  if (kind) label = kind.toUpperCase();
  else if (id.startsWith("pdf-")) label = "PDF";
  else if (id.startsWith("epub-")) label = "EPUB";
  else if (id.startsWith("gutenberg-")) label = "ONLINE";
  else label = "SALVO";
  const origin =
    label === "ONLINE"
      ? "Lê online, grátis"
      : label === "SALVO"
        ? "Na sua lista"
        : fromFile || (!b.device && (id.startsWith("pdf-") || id.startsWith("epub-")))
          ? "Seu arquivo"
          : "Baixado grátis";
  return { label, origin, tone: FORMAT_TONE[label] ?? FORMAT_TONE.SALVO! };
}
