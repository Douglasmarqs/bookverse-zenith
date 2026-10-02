import assert from "node:assert/strict";
import test from "node:test";
import {
  differentReadingPosition,
  legacyRecovery,
  mergeCompletionMarkers,
  reconcileProgress,
} from "../src/lib/progress-reconcile.ts";

const position = (overrides = {}) => ({
  chapterIndex: 2,
  scrollRatio: 0.3,
  overallRatio: 0.4,
  updatedAt: 100,
  ...overrides,
});

test("restores a position from either available source", () => {
  const local = position();
  assert.deepEqual(reconcileProgress(local, null), { progress: local, conflict: null });
  assert.deepEqual(reconcileProgress(null, local), { progress: local, conflict: null });
});

test("asks before changing a genuinely different chapter or PDF page", () => {
  const local = position({ pageIndex: 4 });
  const remote = position({ chapterIndex: 3, pageIndex: 5, updatedAt: 200 });
  assert.equal(differentReadingPosition(local, remote), true);
  assert.deepEqual(reconcileProgress(local, remote), {
    progress: local,
    conflict: { local, remote },
  });
});

test("minor scroll changes do not trigger a conflict", () => {
  const local = position({ scrollRatio: 0.3, completedChapterIndexes: [0] });
  const remote = position({ scrollRatio: 0.31, updatedAt: 200, completedChapterIndexes: [1] });
  const result = reconcileProgress(local, remote);
  assert.equal(result.conflict, null);
  assert.deepEqual(result.progress.completedChapterIndexes, [0, 1]);
  assert.equal(result.progress.updatedAt, 200);
});

test("EPUB reflow does not turn a changed virtual page into a conflict", () => {
  const local = position({ pageIndex: 5, paragraphIndex: 20, scrollRatio: 0.42 });
  const remote = position({ pageIndex: 7, paragraphIndex: 20, scrollRatio: 0.55 });
  assert.equal(differentReadingPosition(local, remote), false);
});

test("completion markers survive choosing an older position", () => {
  const local = position({ completedChapterIndexes: [0, 2] });
  const remote = position({ completedChapterIndexes: [1], bookCompletionRecorded: true });
  const merged = mergeCompletionMarkers(local, remote);
  assert.deepEqual(merged.completedChapterIndexes, [0, 1, 2]);
  assert.equal(merged.bookCompletionRecorded, true);
});

test("an ownerless legacy position requires consent and does not become the account default", () => {
  const legacy = position({
    paragraphIndex: 28,
    completedChapterIndexes: [0, 1],
    bookCompletionRecorded: true,
  });
  const recovery = legacyRecovery(legacy, null);
  assert.equal(recovery.conflict.legacy, true);
  assert.equal(recovery.conflict.local, legacy);
  assert.equal(recovery.progress.chapterIndex, 0);
  assert.equal(recovery.progress.paragraphIndex, undefined);
  assert.deepEqual(recovery.progress.completedChapterIndexes, []);
  assert.equal(recovery.progress.bookCompletionRecorded, false);
});
