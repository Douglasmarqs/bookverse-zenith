import { sanitizeObservabilityRoute } from "./observability.ts";

type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
  }
}

const SAFE_BOUNDARIES = new Set(["tanstack_root_error_component"]);
const SAFE_ERROR_NAMES = new Set([
  "AbortError",
  "DOMException",
  "Error",
  "FirebaseError",
  "NetworkError",
  "RangeError",
  "TypeError",
]);

export function sanitizeLovableErrorContext(
  error: unknown,
  context: Record<string, unknown> = {},
  pathname = "/",
): Record<string, string> {
  const safe: Record<string, string> = {
    source: "react_error_boundary",
    route: sanitizeObservabilityRoute(pathname),
  };
  if (typeof context.boundary === "string" && SAFE_BOUNDARIES.has(context.boundary)) {
    safe.boundary = context.boundary;
  }
  const errorName = error && typeof error === "object" ? (error as { name?: unknown }).name : null;
  if (typeof errorName === "string" && SAFE_ERROR_NAMES.has(errorName)) safe.errorName = errorName;
  return safe;
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const safeContext = sanitizeLovableErrorContext(error, context, window.location.pathname);
  const safeError = new Error("react_error_boundary");
  safeError.name = safeContext.errorName ?? "BookverseBoundaryError";
  window.__lovableEvents?.captureException?.(
    safeError,
    safeContext,
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
