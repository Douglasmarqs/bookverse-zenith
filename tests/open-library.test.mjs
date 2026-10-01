import test from "node:test";
import assert from "node:assert/strict";
import { searchOpenLibrary } from "../src/lib/open-library.ts";

test("catalog normalization ignores malformed API rows", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      docs: [
        { title: "Livro real", key: "/works/OL1W", author_name: ["Autora"], cover_i: 123 },
        { title: "Sem autor", key: "/works/OL2W", author_name: null, cover_i: "bad" },
        { title: "Sem chave" },
        null,
      ],
    }),
  });
  try {
    const books = await searchOpenLibrary("validacao-do-catalogo", 10);
    assert.equal(books.length, 2);
    assert.equal(books[0].author, "Autora");
    assert.equal(books[1].author, "Autor desconhecido");
    assert.equal(books[1].cover, null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
