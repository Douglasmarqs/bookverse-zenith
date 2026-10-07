import { createEpubFixture } from "../fixtures/create-epub.mjs";
import { parseEpubFile } from "../../src/lib/epub-parser.ts";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

/** Run in a browser served by Vite; tests the actual DOMParser/ZIP importer. */
export async function runEpubChecks() {
  const passed = [];
  for (const version of [2, 3]) {
    const source = new File([await createEpubFixture({ version })], `qa-v${version}.epub`, {
      type: "application/epub+zip",
    });
    const book = await parseEpubFile(source);
    expect(book.chapters.length === 2, `EPUB ${version}: spine order`);
    expect(book.navigation?.length === 3, `EPUB ${version}: real TOC`);
    expect(book.navigation[1].depth === 1, `EPUB ${version}: nested TOC`);
    expect(book.navigation[1].paragraphIndex === 31, `EPUB ${version}: fragment paragraph`);
    expect(book.chapters[0].links[61][0].chapterIndex === 1, `EPUB ${version}: cross-chapter link`);
    expect(book.chapters[1].links[1][0].paragraphIndex === 31, `EPUB ${version}: return link`);
    expect(
      !book.chapters.some((c) => c.paragraphs.some((p) => p.includes("__epubAttack"))),
      "Scripts must not become readable paragraphs",
    );
    expect(!window.__epubAttack, "EPUB scripts must not execute");
    passed.push(`EPUB ${version}: spine, TOC, nesting, fragments, links and script exclusion`);
  }
  const adapted = await parseEpubFile(
    new File([await createEpubFixture({ rtl: true, fixed: true })], "rtl-fixed.epub"),
  );
  expect(adapted.chapters[0].direction === "rtl", "Preserve text direction");
  expect(
    adapted.importWarnings?.some((w) => w.includes("layout fixo")),
    "Fixed-layout conversion must be disclosed",
  );
  passed.push("RTL text metadata and fixed-layout warning");
  try {
    await parseEpubFile(new File(["invalid zip"], "broken.epub"));
    throw new Error("Corrupt archive accepted");
  } catch (error) {
    expect(error.message.includes("corrompido"), "Corrupt archive should fail clearly");
  }
  passed.push("Corrupt archive rejected");
  return passed;
}
