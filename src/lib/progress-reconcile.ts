import type { ReadingProgress } from "./reader-store";

export interface ProgressConflict {
  local: ReadingProgress;
  remote: ReadingProgress;
  /** The local position came from an older, accountless browser key. */
  legacy?: boolean;
}

/** A legacy browser key has no UID. The reader must ask before importing it. */
export function legacyRecovery(
  local: ReadingProgress,
  remote: ReadingProgress | null,
): { progress: ReadingProgress; conflict: ProgressConflict } {
  const accountPosition = remote ?? {
    ...local,
    chapterIndex: 0,
    pageIndex: 0,
    scrollRatio: 0,
    overallRatio: 0,
    paragraphIndex: undefined,
    pdfViewport: undefined,
    completedChapterIndexes: [],
    bookCompletionRecorded: false,
    updatedAt: 0,
  };
  return {
    progress: accountPosition,
    conflict: { local, remote: accountPosition, legacy: true },
  };
}

export function differentReadingPosition(a: ReadingProgress, b: ReadingProgress): boolean {
  if (a.chapterIndex !== b.chapterIndex) return true;
  // EPUB pages are viewport-dependent. When both positions have a text anchor,
  // compare that anchor before considering the virtual page or scroll ratio.
  if (a.paragraphIndex !== undefined && b.paragraphIndex !== undefined) {
    return Math.abs(a.paragraphIndex - b.paragraphIndex) > 1;
  }
  if (a.pageIndex !== undefined && b.pageIndex !== undefined && a.pageIndex !== b.pageIndex) {
    return true;
  }
  if (a.pdfViewport || b.pdfViewport) {
    const aViewport = a.pdfViewport ?? { x: 0, y: 0 };
    const bViewport = b.pdfViewport ?? { x: 0, y: 0 };
    return Math.abs(aViewport.x - bViewport.x) > 0.02 || Math.abs(aViewport.y - bViewport.y) > 0.02;
  }
  return Math.abs(a.scrollRatio - b.scrollRatio) > 0.02;
}

/** Completion markers are monotonic even when the reader chooses an older position. */
export function mergeCompletionMarkers(
  selected: ReadingProgress,
  other: ReadingProgress,
): ReadingProgress {
  return {
    ...selected,
    completedChapterIndexes: [
      ...new Set([
        ...(selected.completedChapterIndexes ?? []),
        ...(other.completedChapterIndexes ?? []),
      ]),
    ].sort((a, b) => a - b),
    bookCompletionRecorded: Boolean(
      selected.bookCompletionRecorded || other.bookCompletionRecorded,
    ),
  };
}

export function reconcileProgress(
  local: ReadingProgress | null,
  remote: ReadingProgress | null,
): { progress: ReadingProgress | null; conflict: ProgressConflict | null } {
  if (!local || !remote) return { progress: local ?? remote, conflict: null };
  if (differentReadingPosition(local, remote)) {
    return { progress: local, conflict: { local, remote } };
  }
  const selected = local.updatedAt >= remote.updatedAt ? local : remote;
  const other = selected === local ? remote : local;
  return { progress: mergeCompletionMarkers(selected, other), conflict: null };
}
