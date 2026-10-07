import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePdfViewport,
  capturePdfViewport,
  pdfViewportOffset,
} from "../src/lib/pdf-viewport.ts";
import { differentReadingPosition, legacyRecovery } from "../src/lib/progress-reconcile.ts";

test("old or malformed PDF pan positions have bounded defaults", () => {
  assert.deepEqual(normalizePdfViewport(undefined), { x: 0, y: 0 });
  assert.deepEqual(normalizePdfViewport({ x: -1, y: 5 }), { x: 0, y: 1 });
  assert.deepEqual(normalizePdfViewport({ x: NaN, y: Infinity }), { x: 0, y: 0 });
});

test("PDF pan survives viewport resize and temporarily fitting the whole page", () => {
  const area = {
    scrollWidth: 1000,
    clientWidth: 500,
    scrollHeight: 2000,
    clientHeight: 1000,
    scrollLeft: 200,
    scrollTop: 700,
  };
  const saved = capturePdfViewport(area, { x: 0, y: 0 });
  assert.deepEqual(saved, { x: 0.4, y: 0.7 });
  assert.deepEqual(pdfViewportOffset({ ...area, clientWidth: 250, clientHeight: 500 }, saved), {
    left: 300,
    top: 1050,
  });
  const fitted = { ...area, scrollWidth: 500, scrollHeight: 1000, scrollLeft: 0, scrollTop: 0 };
  assert.deepEqual(capturePdfViewport(fitted, saved), saved);
  assert.deepEqual(pdfViewportOffset(fitted, saved), { left: 0, top: 0 });
});

test("different areas of the same PDF page require a choice, while tiny pans do not", () => {
  const p = {
    chapterIndex: 0,
    pageIndex: 0,
    scrollRatio: 0,
    updatedAt: 1,
    pdfViewport: { x: 0.2, y: 0.3 },
  };
  assert.equal(differentReadingPosition(p, { ...p, pdfViewport: { x: 0.7, y: 0.3 } }), true);
  assert.equal(differentReadingPosition(p, { ...p, pdfViewport: { x: 0.2, y: 0.8 } }), true);
  assert.equal(differentReadingPosition(p, { ...p, pdfViewport: { x: 0.21, y: 0.31 } }), false);
  assert.equal(differentReadingPosition(p, { ...p, pdfViewport: undefined }), true);
  assert.equal(
    differentReadingPosition(
      { ...p, pdfViewport: { x: 0.01, y: 0.01 } },
      { ...p, pdfViewport: undefined },
    ),
    false,
  );
  assert.equal(legacyRecovery(p, null).progress.pdfViewport, undefined);
});
