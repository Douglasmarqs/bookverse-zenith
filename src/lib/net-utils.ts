/**
 * Small network helpers shared by the API clients.
 *
 * Why this exists: pages like the Home/Catálogo render dozens of book cards,
 * each resolving its own metadata. Without a concurrency limit and without
 * "give up early on a source that is clearly down", the browser ends up with
 * 50+ parallel requests, many of them waiting on a 10s callable timeout —
 * which makes the whole tab feel frozen when you click a book.
 */

/** Runs at most `max` tasks concurrently, queueing the rest (FIFO). */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= max) return;
    const run = queue.shift();
    if (!run) return;
    active++;
    run();
  };

  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

/**
 * Circuit breaker: once a source fails, stop calling it for `cooldownMs`
 * instead of paying its timeout on every single card.
 */
export function createBreaker(cooldownMs: number) {
  let openUntil = 0;
  return {
    isOpen: () => Date.now() < openUntil,
    trip: () => {
      openUntil = Date.now() + cooldownMs;
    },
    reset: () => {
      openUntil = 0;
    },
  };
}

/** Deduplicates concurrent calls that share the same key. */
export function createInFlightMap<T>() {
  const map = new Map<string, Promise<T>>();
  return function dedupe(key: string, task: () => Promise<T>): Promise<T> {
    const existing = map.get(key);
    if (existing) return existing;
    const p = task().finally(() => map.delete(key));
    map.set(key, p);
    return p;
  };
}
