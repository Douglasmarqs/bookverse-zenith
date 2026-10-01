export interface PdfDisplaySettings {
  fit: "page" | "width";
  zoom: number;
  pagePadding: number;
  brightness: number;
  contrast: number;
}

export const DEFAULT_PDF_DISPLAY_SETTINGS: PdfDisplaySettings = {
  fit: "page",
  zoom: 1,
  pagePadding: 12,
  brightness: 1,
  contrast: 1,
};

export function normalizePdfDisplaySettings(value: unknown): PdfDisplaySettings {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const number = (
    key: "zoom" | "pagePadding" | "brightness" | "contrast",
    min: number,
    max: number,
  ) => {
    const value = data[key];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : DEFAULT_PDF_DISPLAY_SETTINGS[key];
  };
  return {
    fit: data.fit === "width" ? "width" : "page",
    zoom: number("zoom", 0.75, 2),
    pagePadding: number("pagePadding", 4, 48),
    brightness: number("brightness", 0.75, 1.25),
    contrast: number("contrast", 0.75, 1.5),
  };
}

export function loadPdfDisplaySettings(): PdfDisplaySettings {
  if (typeof window === "undefined") return DEFAULT_PDF_DISPLAY_SETTINGS;
  try {
    return normalizePdfDisplaySettings(
      JSON.parse(localStorage.getItem("bookverse:pdf-display-settings:v1") ?? "{}"),
    );
  } catch {
    return DEFAULT_PDF_DISPLAY_SETTINGS;
  }
}

export function savePdfDisplaySettings(settings: PdfDisplaySettings) {
  try {
    localStorage.setItem(
      "bookverse:pdf-display-settings:v1",
      JSON.stringify(normalizePdfDisplaySettings(settings)),
    );
  } catch {
    // Settings remain usable in memory when browser storage is unavailable.
  }
}
