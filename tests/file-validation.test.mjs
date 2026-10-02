import test from "node:test";
import assert from "node:assert/strict";
import { hasPdfHeader, isEmbeddedRasterImageReference } from "../src/lib/file-validation.ts";

test("accepts a PDF signature near the start and rejects mislabeled files", () => {
  assert.equal(hasPdfHeader(new TextEncoder().encode("%PDF-1.7\n")), true);
  assert.equal(hasPdfHeader(new TextEncoder().encode("\n%PDF-1.4\n")), true);
  assert.equal(hasPdfHeader(new TextEncoder().encode("<html>not a PDF</html>")), false);
});

test("EPUB images must be packaged raster resources", () => {
  assert.equal(isEmbeddedRasterImageReference("../images/cover%20art.jpg"), true);
  assert.equal(isEmbeddedRasterImageReference("images/picture.png#fragment"), true);
  for (const href of [
    "https://example.com/tracker.jpg",
    "//example.com/tracker.jpg",
    "data:image/png;base64,abcd",
    "images/active.svg",
    "javascript:alert(1).png",
    "%2F%2Fexample.com/tracker.jpg",
  ]) {
    assert.equal(isEmbeddedRasterImageReference(href), false, href);
  }
});
