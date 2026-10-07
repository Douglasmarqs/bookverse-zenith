/** Check content as well as the filename before accepting a private import. */
export function hasPdfHeader(header: Uint8Array): boolean {
  const marker = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  for (let offset = 0; offset <= header.length - marker.length; offset += 1) {
    if (marker.every((byte, index) => header[offset + index] === byte)) return true;
  }
  return false;
}

/** Only images packed inside the EPUB may be displayed by the reader. */
export function isEmbeddedRasterImageReference(raw: string): boolean {
  const href = raw.split(/[?#]/, 1)[0]?.trim();
  if (!href || href.startsWith("/") || href.startsWith("\\")) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    return false;
  }
  if (decoded.startsWith("/") || decoded.startsWith("\\") || /^[a-z][a-z\d+.-]*:/i.test(decoded))
    return false;
  return /\.(?:jpe?g|png|gif|webp)$/i.test(decoded);
}
