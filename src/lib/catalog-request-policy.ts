export interface CatalogRequestPolicyOptions {
  maxAttempts?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  minIntervalMs?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class CatalogRequestError extends Error {
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(message: string, options: { status?: number; retryAfterMs?: number } = {}) {
    super(message);
    this.name = "CatalogRequestError";
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export class CatalogCircuitOpenError extends Error {
  readonly retryAt: number;

  constructor(retryAt: number) {
    super("Catalog provider circuit is temporarily open");
    this.name = "CatalogCircuitOpenError";
    this.retryAt = retryAt;
  }
}

export function parseRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export function isRetryableCatalogError(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  if (typeof status !== "number") return true;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Provider-level guard shared by catalog requests. It spaces request starts,
 * retries only transient failures and opens after repeated failed request
 * cycles. Once the cooldown expires, a single probe decides whether to close
 * the circuit. */
export class CatalogRequestPolicy {
  private readonly maxAttempts: number;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly minIntervalMs: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private consecutiveFailures = 0;
  private openUntil = 0;
  private probeInFlight = false;
  private nextStartAt = 0;

  constructor(options: CatalogRequestPolicyOptions = {}) {
    this.maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? 2));
    this.failureThreshold = Math.max(1, Math.trunc(options.failureThreshold ?? 3));
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 30_000);
    this.minIntervalMs = Math.max(0, options.minIntervalMs ?? 250);
    this.baseRetryDelayMs = Math.max(0, options.baseRetryDelayMs ?? 350);
    this.maxRetryDelayMs = Math.max(this.baseRetryDelayMs, options.maxRetryDelayMs ?? 3_000);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async waitForRateLimit(): Promise<void> {
    const now = this.now();
    const startAt = Math.max(now, this.nextStartAt);
    this.nextStartAt = startAt + this.minIntervalMs;
    const waitMs = startAt - now;
    if (waitMs > 0) await this.sleep(waitMs);
  }

  private retryDelay(error: unknown, attempt: number): number {
    const retryAfter = (error as { retryAfterMs?: unknown })?.retryAfterMs;
    if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
      return Math.min(this.maxRetryDelayMs, Math.max(0, retryAfter));
    }
    return Math.min(this.maxRetryDelayMs, this.baseRetryDelayMs * 2 ** attempt);
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const now = this.now();
    if (now < this.openUntil || (this.openUntil > 0 && this.probeInFlight)) {
      throw new CatalogCircuitOpenError(this.openUntil);
    }

    const probing = this.openUntil > 0;
    if (probing) this.probeInFlight = true;
    let lastError: unknown;
    try {
      for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
        await this.waitForRateLimit();
        try {
          const result = await operation();
          this.consecutiveFailures = 0;
          this.openUntil = 0;
          return result;
        } catch (error) {
          lastError = error;
          if (!isRetryableCatalogError(error)) {
            this.consecutiveFailures = 0;
            this.openUntil = 0;
            throw error;
          }
          if (attempt + 1 < this.maxAttempts) await this.sleep(this.retryDelay(error, attempt));
        }
      }

      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.openUntil = this.now() + this.cooldownMs;
      }
      throw lastError;
    } finally {
      if (probing) this.probeInFlight = false;
    }
  }
}
