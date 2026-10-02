import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PDF_DISPLAY_SETTINGS,
  normalizePdfDisplaySettings,
  loadPdfDisplaySettings,
  savePdfDisplaySettings,
} from "../src/lib/pdf-display-settings.ts";
import { clampPdfPage, pdfFitScale, pdfOutputScale } from "../src/lib/pdf-viewport.ts";

test("old PDF settings keep their preferences and default to full-page fit", () => {
  assert.deepEqual(normalizePdfDisplaySettings({ zoom: 1.5, pagePadding: 24 }), {
    ...DEFAULT_PDF_DISPLAY_SETTINGS,
    zoom: 1.5,
    pagePadding: 24,
  });
});

test("malformed PDF preferences cannot create invalid or unbounded canvases", () => {
  for (const value of [null, false, [], "invalid"]) {
    assert.deepEqual(normalizePdfDisplaySettings(value), DEFAULT_PDF_DISPLAY_SETTINGS);
  }
  assert.deepEqual(
    normalizePdfDisplaySettings({
      fit: "invalid",
      zoom: Infinity,
      pagePadding: -100,
      brightness: "1",
      contrast: 100,
    }),
    {
      ...DEFAULT_PDF_DISPLAY_SETTINGS,
      pagePadding: 4,
      contrast: 1.5,
    },
  );
  assert.equal(normalizePdfDisplaySettings({ fit: "width", zoom: 900 }).zoom, 2);
});

test("PDF settings remain usable when localStorage is denied or malformed", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage denied");
      },
    });
    assert.deepEqual(loadPdfDisplaySettings(), DEFAULT_PDF_DISPLAY_SETTINGS);
    assert.doesNotThrow(() => savePdfDisplaySettings(DEFAULT_PDF_DISPLAY_SETTINGS));
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => "{invalid" },
    });
    assert.deepEqual(loadPdfDisplaySettings(), DEFAULT_PDF_DISPLAY_SETTINGS);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
});

test("width fit fills a landscape viewport while full-page fit keeps the page visible", () => {
  const page = { width: 600, height: 900 };
  const stage = { width: 1000, height: 500 };
  assert.equal(pdfFitScale(page, stage, 10, "page"), 480 / 900);
  assert.equal(pdfFitScale(page, stage, 10, "width"), 980 / 600);
  assert.equal(pdfFitScale(page, { width: 320, height: 650 }, 12, "width"), 296 / 600);
});

test("large and high-DPI PDF pages stay inside mobile pixel/dimension budgets", () => {
  for (const [width, height, dpr] of [
    [800, 1200, 3],
    [6000, 9000, 2],
    [100, 20000, 1],
    [3000, 3000, 3],
  ]) {
    const scale = pdfOutputScale(width, height, dpr);
    assert.ok(width * scale <= 4096);
    assert.ok(height * scale <= 4096);
    assert.ok(width * height * scale * scale <= 8_000_001);
  }
});

test("restored PDF pages cannot exceed the real document bounds", () => {
  assert.equal(clampPdfPage(100, 12), 12);
  assert.equal(clampPdfPage(-3, 12), 1);
  assert.equal(clampPdfPage(NaN, 12), 1);
  assert.equal(clampPdfPage(4.6, 12), 4);
});
