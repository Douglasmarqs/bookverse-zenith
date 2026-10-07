export const PRODUCT_EVENT_NAMES = [
  "reader_load_failed",
  "epub_parse_failed",
  "pdf_render_failed",
  "catalog_request_failed",
  "sync_conflict",
  "book_open_failed",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

const SAFE_METADATA_KEYS = new Set([
  "durationMs",
  "format",
  "legacy",
  "offline",
  "operation",
  "provider",
  "stage",
  "status",
]);

const SAFE_METADATA_VALUES: Record<string, ReadonlySet<string>> = {
  format: new Set(["epub", "pdf", "public-domain"]),
  operation: new Set(["progress-write"]),
  provider: new Set(["gutendex", "open-library", "storage"]),
  stage: new Set([
    "catalog",
    "cloud",
    "curated",
    "download",
    "fetch",
    "local",
    "monthly",
    "parse",
    "render",
    "weekly",
  ]),
};

const SAFE_ERROR_NAMES = new Set([
  "AbortError",
  "DOMException",
  "Error",
  "FirebaseError",
  "NetworkError",
  "RangeError",
  "TypeError",
]);

const SAFE_ERROR_CODES = new Set([
  "aborted",
  "already-exists",
  "auth/network-request-failed",
  "cancelled",
  "data-loss",
  "deadline-exceeded",
  "failed-precondition",
  "functions/deadline-exceeded",
  "functions/internal",
  "functions/unauthenticated",
  "functions/unavailable",
  "internal",
  "invalid-argument",
  "not-found",
  "out-of-range",
  "permission-denied",
  "resource-exhausted",
  "storage/object-not-found",
  "storage/retry-limit-exceeded",
  "storage/unauthenticated",
  "storage/unauthorized",
  "unauthenticated",
  "unavailable",
  "unimplemented",
  "unknown",
]);

function routeTemplate(pathname: string): string {
  if (/^\/reader\/[^/]+/.test(pathname)) return "/reader/:bookId";
  if (/^\/livro\/[^/]+/.test(pathname)) return "/livro/:slug";
  return pathname || "/";
}

function safeErrorName(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_ERROR_NAMES.has(value) ? value : undefined;
}

function safeErrorCode(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_ERROR_CODES.has(value) ? value : undefined;
}

/** Keeps telemetry deliberately low-cardinality. Titles, user IDs, book IDs,
 * search text, excerpts and arbitrary error messages are discarded. */
export function sanitizeObservabilityContext(
  event: ProductEventName,
  metadata: Record<string, unknown> = {},
  error?: unknown,
  pathname = "/",
): Record<string, string | number | boolean> {
  const context: Record<string, string | number | boolean> = {
    event,
    route: routeTemplate(pathname),
  };
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if ((key === "legacy" || key === "offline") && typeof value === "boolean") {
      context[key] = value;
      continue;
    }
    if (key === "status" && typeof value === "number" && Number.isInteger(value)) {
      if (value >= 100 && value <= 599) context[key] = value;
      continue;
    }
    if (key === "durationMs" && typeof value === "number" && Number.isFinite(value)) {
      context[key] = Math.min(60_000, Math.max(0, Math.round(value / 100) * 100));
      continue;
    }
    if (typeof value === "string" && SAFE_METADATA_VALUES[key]?.has(value)) context[key] = value;
  }

  if (error && typeof error === "object") {
    const errorName = safeErrorName((error as { name?: unknown }).name);
    const errorCode = safeErrorCode((error as { code?: unknown }).code);
    if (errorName) context.errorName = errorName;
    if (errorCode) context.errorCode = errorCode;
  }
  return context;
}

export function reportProductEvent(
  event: ProductEventName,
  error?: unknown,
  metadata: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  const context = sanitizeObservabilityContext(event, metadata, error, window.location.pathname);
  console.warn(`[bookverse] ${event}`, context);

  const safeError = new Error(event);
  safeError.name = typeof context.errorName === "string" ? context.errorName : "BookverseEvent";
  window.__lovableEvents?.captureException?.(safeError, context, {
    mechanism: "manual",
    handled: true,
    severity: event === "sync_conflict" ? "info" : "warning",
  });
}
