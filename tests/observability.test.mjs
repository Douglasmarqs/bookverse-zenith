import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeObservabilityContext } from "../src/lib/observability.ts";
import { sanitizeLovableErrorContext } from "../src/lib/lovable-error-reporting.ts";

test("observability removes private identifiers, content and arbitrary error messages", () => {
  const error = Object.assign(new Error("trecho privado do livro"), {
    code: "storage/object-not-found",
  });
  const context = sanitizeObservabilityContext(
    "book_open_failed",
    {
      bookId: "private-book-id",
      excerpt: "conteúdo privado",
      format: "epub",
      provider: "storage",
      stage: "download",
      operation: "private-book-id",
      uid: "private-user-id",
    },
    error,
    "/reader/private-book-id",
  );

  assert.deepEqual(context, {
    event: "book_open_failed",
    route: "/reader/:bookId",
    format: "epub",
    provider: "storage",
    stage: "download",
    errorName: "Error",
    errorCode: "storage/object-not-found",
  });
  assert.equal(JSON.stringify(context).includes("private"), false);
});

test("observability drops unsafe error codes and normalizes public book routes", () => {
  const context = sanitizeObservabilityContext(
    "catalog_request_failed",
    { offline: true, status: 503, query: "nome de uma pessoa" },
    { name: "TypeError", code: "private-book-id" },
    "/livro/a-private-slug",
  );

  assert.deepEqual(context, {
    event: "catalog_request_failed",
    route: "/livro/:slug",
    offline: true,
    status: 503,
    errorName: "TypeError",
  });
});

test("observability bounds numeric metadata and rejects arbitrary allowlisted-key values", () => {
  const context = sanitizeObservabilityContext(
    "reader_load_failed",
    {
      durationMs: 1234,
      format: "a-private-book-id",
      offline: false,
      provider: "private-user-id",
      status: 999,
    },
    { name: "PrivateBookError", code: "private-book-id" },
    "/reader/private-book-id?excerpt=private",
  );

  assert.deepEqual(context, {
    event: "reader_load_failed",
    route: "/reader/:bookId",
    durationMs: 1200,
    offline: false,
  });
  assert.equal(JSON.stringify(context).includes("private"), false);
});

test("global error reporting discards raw errors, private routes and arbitrary context", () => {
  const context = sanitizeLovableErrorContext(
    new TypeError("private excerpt and user id"),
    {
      boundary: "tanstack_root_error_component",
      bookId: "private-book-id",
      excerpt: "private excerpt",
      uid: "private-user-id",
    },
    "/reader/private-book-id",
  );

  assert.deepEqual(context, {
    source: "react_error_boundary",
    route: "/reader/:bookId",
    boundary: "tanstack_root_error_component",
    errorName: "TypeError",
  });
  assert.equal(JSON.stringify(context).includes("private"), false);
});
