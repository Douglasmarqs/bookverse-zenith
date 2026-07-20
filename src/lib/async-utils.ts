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

/**
 * Turns a Firestore/Firebase error into a clear, non-technical Portuguese
 * message. Firestore's own message for a denied write is literally
 * "Missing or insufficient permissions." — accurate for a developer, not
 * useful for an end user, so this maps the known `.code` values to
 * something actionable and falls back to the raw message only when we
 * don't recognize the code.
 */
export function describeFirestoreError(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "permission-denied":
      "Sem permissão para salvar isso agora — o app ainda está sendo configurado. Tente novamente em instantes.",
    unauthenticated: "Sua sessão expirou. Atualize a página e faça login novamente.",
    unavailable: "Não foi possível conectar agora. Verifique sua conexão e tente novamente.",
    "resource-exhausted": "Muitas solicitações agora. Aguarde um instante e tente novamente.",
    cancelled: "A operação foi cancelada. Tente novamente.",
    "deadline-exceeded": TIMEOUT_MESSAGE,
  };
  if (code && map[code]) return map[code];
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
