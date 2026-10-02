import assert from "node:assert/strict";
import test from "node:test";
import { resolveEpubHref, resolveBookLocation } from "../src/lib/epub-navigation.ts";
import { legacyDemoTitle } from "../src/lib/legacy-demo.ts";

test("EPUB links resolve relative paths, encoded filenames and same-file fragments", () => {
  assert.deepEqual(resolveEpubHref("OPS/Text/chapter.xhtml", "../Notes/notes.xhtml#note%201"), {
    path: "OPS/Notes/notes.xhtml",
    fragment: "note 1",
  });
  assert.deepEqual(resolveEpubHref("OPS/Text/chapter.xhtml", "#section"), {
    path: "OPS/Text/chapter.xhtml",
    fragment: "section",
  });
  assert.deepEqual(resolveEpubHref("OPS/nav.xhtml", "Text/cap%C3%ADtulo.xhtml"), {
    path: "OPS/Text/capítulo.xhtml",
    fragment: "",
  });
});

test("EPUB archive links reject external schemes, malformed escapes and traversal", () => {
  for (const href of [
    "https://example.com/a",
    "//example.com/a",
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///a",
    "../../../a",
    "%2f%2fexample.com/a",
    "bad%zz",
    "..\\a",
    "java\nscript:alert(1)",
  ]) {
    assert.equal(resolveEpubHref("OPS/Text/chapter.xhtml", href), null, href);
  }
});

test("EPUB targets map to stable paragraph indices and missing destinations stay unavailable", () => {
  const chapters = [
    { sourcePath: "OPS/Text/one.xhtml", anchors: { section: 31 } },
    { sourcePath: "OPS/Text/two.xhtml", anchors: { note: 0 } },
  ];
  assert.deepEqual(resolveBookLocation(chapters, "OPS/nav.xhtml", "Text/one.xhtml#section"), {
    chapterIndex: 0,
    paragraphIndex: 31,
  });
  assert.deepEqual(resolveBookLocation(chapters, "OPS/Text/one.xhtml", "two.xhtml#note"), {
    chapterIndex: 1,
    paragraphIndex: 0,
  });
  assert.equal(resolveBookLocation(chapters, "OPS/nav.xhtml", "Text/one.xhtml#missing"), null);
  assert.equal(resolveBookLocation(chapters, "OPS/nav.xhtml", "Text/one.xhtml#__proto__"), null);
  assert.equal(resolveBookLocation(chapters, "OPS/nav.xhtml", "missing.xhtml"), null);
});

test("retired demo URLs retain their identity without resolving arbitrary object properties", () => {
  assert.equal(legacyDemoTitle("casa-espiritos"), "A Casa dos Espíritos");
  assert.equal(legacyDemoTitle("__proto__"), null);
  assert.equal(legacyDemoTitle("epub-123"), null);
});
