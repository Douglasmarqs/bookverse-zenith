export interface PdfDisplaySettings {
  zoom: number;
  pagePadding: number;
  brightness: number;
  contrast: number;
}

const DEFAULT_PDF_DISPLAY_SETTINGS: PdfDisplaySettings = {
  zoom: 1,
  pagePadding: 12,
  brightness: 1,
  contrast: 1,
};

export function loadPdfDisplaySettings(): PdfDisplaySettings {
  if (typeof window === "undefined") return DEFAULT_PDF_DISPLAY_SETTINGS;
  try {
    return {
      ...DEFAULT_PDF_DISPLAY_SETTINGS,
      ...(JSON.parse(
        localStorage.getItem("bookverse:pdf-display-settings:v1") ?? "{}",
      ) as Partial<PdfDisplaySettings>),
    };
  } catch {
    return DEFAULT_PDF_DISPLAY_SETTINGS;
  }
}

export function savePdfDisplaySettings(settings: PdfDisplaySettings) {
  localStorage.setItem("bookverse:pdf-display-settings:v1", JSON.stringify(settings));
}
