export const GAMIFICATION_MILESTONES = [
  "book-added",
  "chapter-completed",
  "book-completed",
  "diary-entry",
  "review-published",
  "reading-session",
] as const;

export type GamificationMilestone = (typeof GAMIFICATION_MILESTONES)[number];

export interface MilestoneDetails {
  chapterIndex?: number;
  chapterCount?: number;
  pagesRead?: number;
  readingMinutes?: number;
}

export interface PendingMilestone {
  type: GamificationMilestone;
  resourceId: string;
  details: MilestoneDetails;
  queuedAt: number;
  attempts: number;
}

const MAX_PENDING_MILESTONES = 50;

export function milestoneQueueId(milestone: Pick<PendingMilestone, "type" | "resourceId">): string {
  return `${milestone.type}:${milestone.resourceId}`;
}

function finiteInteger(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
}

function normalizeDetails(value: unknown): MilestoneDetails {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const details: MilestoneDetails = {};
  for (const key of ["chapterIndex", "chapterCount", "pagesRead", "readingMinutes"] as const) {
    const number = finiteInteger(input[key]);
    if (number !== undefined) details[key] = number;
  }
  return details;
}

export function normalizePendingMilestones(value: unknown): PendingMilestone[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, PendingMilestone>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (!GAMIFICATION_MILESTONES.includes(candidate.type as GamificationMilestone)) continue;
    if (
      typeof candidate.resourceId !== "string" ||
      !candidate.resourceId ||
      candidate.resourceId.length > 180
    ) {
      continue;
    }
    const pending: PendingMilestone = {
      type: candidate.type as GamificationMilestone,
      resourceId: candidate.resourceId,
      details: normalizeDetails(candidate.details),
      queuedAt: Math.max(0, finiteInteger(candidate.queuedAt) ?? 0),
      attempts: Math.max(0, finiteInteger(candidate.attempts) ?? 0),
    };
    unique.set(milestoneQueueId(pending), pending);
  }
  return [...unique.values()]
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .slice(-MAX_PENDING_MILESTONES);
}

export function queueMilestone(
  queue: PendingMilestone[],
  milestone: Omit<PendingMilestone, "attempts">,
): PendingMilestone[] {
  const id = milestoneQueueId(milestone);
  const existing = queue.find((item) => milestoneQueueId(item) === id);
  const next = queue.filter((item) => milestoneQueueId(item) !== id);
  next.push({
    ...milestone,
    queuedAt: existing?.queuedAt ?? milestone.queuedAt,
    attempts: existing?.attempts ?? 0,
  });
  return normalizePendingMilestones(next);
}

export function markMilestoneAttempt(
  queue: PendingMilestone[],
  milestone: Pick<PendingMilestone, "type" | "resourceId">,
): PendingMilestone[] {
  const id = milestoneQueueId(milestone);
  return queue.map((item) =>
    milestoneQueueId(item) === id ? { ...item, attempts: item.attempts + 1 } : item,
  );
}

export function removeMilestone(
  queue: PendingMilestone[],
  milestone: Pick<PendingMilestone, "type" | "resourceId">,
): PendingMilestone[] {
  const id = milestoneQueueId(milestone);
  return queue.filter((item) => milestoneQueueId(item) !== id);
}

/** Callable errors that can become valid after the connection, emulator or
 * dependent Firestore document becomes available. Validation/auth failures
 * are permanent and should not occupy the local queue forever. */
export function isRetryableMilestoneError(error: unknown): boolean {
  const raw = String((error as { code?: string })?.code ?? "").toLowerCase();
  const code = raw.replace(/^functions\//, "");
  return (
    !code ||
    code === "cancelled" ||
    code === "unknown" ||
    code === "deadline-exceeded" ||
    code === "resource-exhausted" ||
    code === "failed-precondition" ||
    code === "internal" ||
    code === "unavailable" ||
    code.includes("network") ||
    code.includes("timeout")
  );
}
