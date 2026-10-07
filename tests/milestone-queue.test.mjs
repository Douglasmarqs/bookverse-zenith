import assert from "node:assert/strict";
import test from "node:test";

import {
  isRetryableMilestoneError,
  markMilestoneAttempt,
  normalizePendingMilestones,
  queueMilestone,
  removeMilestone,
} from "../src/lib/milestone-queue.ts";

const milestone = (resourceId, queuedAt = 1) => ({
  type: "chapter-completed",
  resourceId,
  details: { chapterIndex: 2, chapterCount: 8, pagesRead: 4.8 },
  queuedAt,
});

test("milestone queue deduplicates idempotent events and keeps the first timestamp", () => {
  const first = queueMilestone([], milestone("book:2", 100));
  const second = queueMilestone(first, {
    ...milestone("book:2", 900),
    details: { chapterIndex: 2, chapterCount: 8, pagesRead: 7 },
  });

  assert.equal(second.length, 1);
  assert.equal(second[0].queuedAt, 100);
  assert.equal(second[0].details.pagesRead, 7);
});

test("milestone queue remains bounded and discards malformed persisted rows", () => {
  const rows = Array.from({ length: 55 }, (_, index) => ({
    ...milestone(`book:${index}`, index),
    attempts: index,
  }));
  rows.push({ type: "made-up", resourceId: "bad" }, { type: "book-added", resourceId: "" });

  const normalized = normalizePendingMilestones(rows);
  assert.equal(normalized.length, 50);
  assert.equal(normalized[0].resourceId, "book:5");
  assert.equal(normalized.at(-1).attempts, 54);
  assert.equal(normalized.at(-1).details.pagesRead, 4);
});

test("attempt and removal operations affect only the matching milestone", () => {
  const queue = [...queueMilestone([], milestone("a")), ...queueMilestone([], milestone("b", 2))];
  const attempted = markMilestoneAttempt(queue, { type: "chapter-completed", resourceId: "a" });
  assert.equal(attempted[0].attempts, 1);
  assert.equal(attempted[1].attempts, 0);
  assert.deepEqual(
    removeMilestone(attempted, { type: "chapter-completed", resourceId: "a" }).map(
      (item) => item.resourceId,
    ),
    ["b"],
  );
});

test("only transient callable failures stay queued", () => {
  for (const code of [
    "functions/unavailable",
    "functions/deadline-exceeded",
    "failed-precondition",
    "network-request-failed",
  ]) {
    assert.equal(isRetryableMilestoneError({ code }), true, code);
  }
  for (const code of [
    "functions/unauthenticated",
    "functions/invalid-argument",
    "permission-denied",
  ]) {
    assert.equal(isRetryableMilestoneError({ code }), false, code);
  }
});
