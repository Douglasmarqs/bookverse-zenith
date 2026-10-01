import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function workerHarness() {
  const handlers = new Map();
  const cachedPaths = [];
  const response = {
    ok: true,
    headers: { get: () => null },
    clone() {
      return this;
    },
  };
  const cache = {
    put: async (request) => {
      cachedPaths.push(new URL(request.url).pathname);
    },
  };
  const caches = {
    open: async () => cache,
    match: async () => null,
    keys: async () => [],
    delete: async () => true,
  };
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://bookverse.test" },
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
    caches,
    fetch: async () => response,
    URL,
    Response,
  });
  async function request(path, mode = "cors") {
    let result;
    handlers.get("fetch")({
      request: { method: "GET", mode, url: `https://bookverse.test${path}` },
      respondWith: (promise) => {
        result = promise;
      },
    });
    if (result) await result;
    await new Promise((resolve) => setImmediate(resolve));
    return Boolean(result);
  }
  return { request, cachedPaths };
}

test("worker leaves private data and development modules to the network", async () => {
  const worker = workerHarness();
  assert.equal(await worker.request("/src/routes/catalogo.tsx"), false);
  assert.equal(await worker.request("/api/user-library"), false);
  assert.equal(await worker.request("/reader/private-book", "navigate"), true);
  assert.deepEqual(worker.cachedPaths, []);
});

test("worker caches only a public navigation and a hashed build asset", async () => {
  const worker = workerHarness();
  assert.equal(await worker.request("/catalogo", "navigate"), true);
  assert.equal(await worker.request("/assets/index-abc123.js"), true);
  assert.deepEqual(worker.cachedPaths, ["/catalogo", "/assets/index-abc123.js"]);
});
