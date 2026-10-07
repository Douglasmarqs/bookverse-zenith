import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogCircuitOpenError,
  CatalogRequestError,
  CatalogRequestPolicy,
  parseRetryAfterMs,
} from "../src/lib/catalog-request-policy.ts";

function controlledPolicy(options = {}) {
  let clock = 0;
  const sleeps = [];
  const policy = new CatalogRequestPolicy({
    minIntervalMs: 0,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    ...options,
  });
  return { policy, sleeps, now: () => clock, advance: (ms) => (clock += ms) };
}

test("catalog policy retries one transient failure and then closes cleanly", async () => {
  const { policy, sleeps } = controlledPolicy({ baseRetryDelayMs: 25, maxAttempts: 2 });
  let calls = 0;
  const result = await policy.run(async () => {
    calls += 1;
    if (calls === 1) throw new CatalogRequestError("temporary", { status: 503 });
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [25]);
});

test("catalog policy does not retry permanent HTTP failures", async () => {
  const { policy, sleeps } = controlledPolicy({ maxAttempts: 3 });
  let calls = 0;
  await assert.rejects(
    policy.run(async () => {
      calls += 1;
      throw new CatalogRequestError("bad request", { status: 400 });
    }),
    /bad request/,
  );
  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
});

test("catalog circuit opens after repeated failures and a successful cooldown probe closes it", async () => {
  const { policy, advance } = controlledPolicy({
    cooldownMs: 1_000,
    failureThreshold: 2,
    maxAttempts: 1,
  });
  let calls = 0;
  const fail = () => {
    calls += 1;
    return Promise.reject(new TypeError("network"));
  };

  await assert.rejects(policy.run(fail), /network/);
  await assert.rejects(policy.run(fail), /network/);
  await assert.rejects(policy.run(fail), CatalogCircuitOpenError);
  assert.equal(calls, 2);

  advance(1_001);
  assert.equal(await policy.run(async () => "recovered"), "recovered");
  assert.equal(await policy.run(async () => "healthy"), "healthy");
});

test("catalog policy spaces request starts and honors bounded Retry-After", async () => {
  const { policy, now, sleeps } = controlledPolicy({
    baseRetryDelayMs: 10,
    maxAttempts: 2,
    maxRetryDelayMs: 500,
    minIntervalMs: 100,
  });
  const starts = [];
  let calls = 0;
  await policy.run(async () => {
    starts.push(now());
    calls += 1;
    if (calls === 1)
      throw new CatalogRequestError("busy", { status: 429, retryAfterMs: 5_000 });
    return "ok";
  });
  await policy.run(async () => {
    starts.push(now());
    return "next";
  });

  assert.deepEqual(starts, [0, 500, 600]);
  assert.deepEqual(sleeps, [500, 100]);
  assert.equal(parseRetryAfterMs("2", 0), 2_000);
  assert.equal(parseRetryAfterMs("invalid", 0), undefined);
});
