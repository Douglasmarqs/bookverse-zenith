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

export interface PdfViewportPosition {
  x: number;
  y: number;
}

export function normalizePdfViewport(value: unknown): PdfViewportPosition {
  const position =
    value && typeof value === "object" ? (value as Partial<PdfViewportPosition>) : {};
  const ratio = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  return { x: ratio(position.x), y: ratio(position.y) };
}

type ScrollArea = {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  scrollLeft: number;
  scrollTop: number;
};

export function capturePdfViewport(
  area: ScrollArea,
  previous: PdfViewportPosition,
): PdfViewportPosition {
  const width = area.scrollWidth - area.clientWidth;
  const height = area.scrollHeight - area.clientHeight;
  // Fitting the entire page should not erase where the reader was zoomed in.
  return normalizePdfViewport({
    x: width > 1 ? area.scrollLeft / width : previous.x,
    y: height > 1 ? area.scrollTop / height : previous.y,
  });
}

export function pdfViewportOffset(area: ScrollArea, position: PdfViewportPosition) {
  const { x, y } = normalizePdfViewport(position);
  return {
    left: x * Math.max(0, area.scrollWidth - area.clientWidth),
    top: y * Math.max(0, area.scrollHeight - area.clientHeight),
  };
}
