import test from "node:test";
import assert from "node:assert/strict";
import {
  CURATED_PUBLIC_DOMAIN_CLASSIC_IDS,
  normalizePublicDomainBooks,
} from "../src/lib/public-domain-catalog.ts";

function book(
  id,
  title,
  formats = { "text/plain; charset=utf-8": `https://example.test/${id}.txt` },
) {
  return {
    id,
    title,
    authors: [{ name: `Autor ${id}` }],
    languages: [id > 50_000 ? "pt" : "en"],
    subjects: ["Fiction", "Classic literature", "Extra", "Fourth", "Ignored"],
    formats: { ...formats, "image/jpeg": `http://example.test/${id}.jpg` },
  };
}

test("curated classics prioritize verified Portuguese editions", () => {
  assert.deepEqual(
    CURATED_PUBLIC_DOMAIN_CLASSIC_IDS.slice(0, 5),
    [55752, 54829, 67740, 69187, 18220],
  );
  assert.equal(
    new Set(CURATED_PUBLIC_DOMAIN_CLASSIC_IDS).size,
    CURATED_PUBLIC_DOMAIN_CLASSIC_IDS.length,
  );
});

test("public-domain catalog only advertises editions with readable text", () => {
  const normalized = normalizePublicDomainBooks(
    [
      book(55752, "Dom Casmurro"),
      book(54829, "Sem texto", { "text/html": "https://example.test/book.html" }),
      book(-1, "ID inválido"),
      { id: 84, title: "", formats: { "text/plain": "https://example.test/84.txt" } },
    ],
    { maxResults: 12 },
  );

  assert.deepEqual(normalized, [
    {
      id: 55752,
      title: "Dom Casmurro",
      author: "Autor 55752",
      cover: "https://example.test/55752.jpg",
      languages: ["pt"],
      subjects: ["Fiction", "Classic literature", "Extra", "Fourth"],
      availability: "read",
    },
  ]);
});

test("curated responses follow editorial order and remove duplicate editions", () => {
  const normalized = normalizePublicDomainBooks(
    [book(84, "Frankenstein"), book(55752, "Dom Casmurro"), book(84, "Duplicado")],
    { maxResults: 2, preferredIds: [55752, 84] },
  );

  assert.deepEqual(
    normalized.map(({ id, title }) => ({ id, title })),
    [
      { id: 55752, title: "Dom Casmurro" },
      { id: 84, title: "Frankenstein" },
    ],
  );
});
