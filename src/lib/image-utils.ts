/** Reads a File (e.g. from a file input) as a data URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscales an uploaded image file to a JPEG data URL within `maxDim` on
 * its longest side. Used for anything stored directly in a Firestore
 * document (profile photos, book covers) rather than a separate storage
 * bucket — keeping the encoded size small is what makes that viable under
 * Firestore's 1MB-per-document limit.
 */
export async function downscaleImageFile(
  file: File,
  maxDim: number,
  quality = 0.85,
): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
    el.src = raw;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
