/** Keep large/zoomed PDFs within mobile canvas memory and dimension limits. */
export function pdfOutputScale(width: number, height: number, deviceScale: number): number {
  return Math.min(
    Math.max(1, deviceScale || 1),
    2,
    4096 / width,
    4096 / height,
    Math.sqrt(8_000_000 / (width * height)),
  );
}

export function pdfFitScale(
  page: { width: number; height: number },
  stage: { width: number; height: number },
  padding: number,
  fit: "page" | "width",
): number {
  const width = Math.max(80, stage.width - padding * 2) / page.width;
  const height = Math.max(80, stage.height - padding * 2) / page.height;
  return fit === "width" ? width : Math.min(width, height);
}

export function clampPdfPage(page: number, count: number): number {
  return Math.max(1, Math.min(Math.max(1, count), Number.isFinite(page) ? Math.trunc(page) : 1));
}
