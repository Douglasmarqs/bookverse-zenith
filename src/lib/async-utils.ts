/**
 * Small helpers used to make every Firestore round-trip in the app
 * bounded — a slow/blocked network should surface a clear error or a
 * graceful fallback within a few seconds, never leave a button stuck on
 * "Salvando…" forever.
 */

/**
 * Races `promise` against a timer. If the timer wins (or `promise`
 * rejects), resolves to `fallback` instead of throwing. Use this for
 * "nice to have" reads that should degrade gracefully — never blocks a
 * write from happening.
 */
export function withFallback<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}

/**
 * Races `promise` against a timer. If the timer wins, rejects with a clear,
 * user-facing error message instead of hanging forever. Use this for writes
 * where the caller genuinely needs to know if it failed.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(message));
      }
    }, ms);
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      },
    );
  });
}

export const TIMEOUT_MESSAGE =
  "Isso demorou mais que o esperado. Verifique sua conexão e tente novamente.";
