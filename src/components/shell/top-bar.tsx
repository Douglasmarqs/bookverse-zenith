import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

type Fallback = "/" | "/perfil" | "/descobrir" | "/biblioteca" | "/ajustes";

/**
 * Visible "back" for every secondary screen — swipe-back alone isn't
 * discoverable (and doesn't exist on Android/desktop). Goes back in history
 * when there is somewhere to go, otherwise to a sensible parent screen.
 */
export function BackButton({
  fallback = "/",
  label = "Voltar",
  className = "",
}: {
  fallback?: Fallback;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        if (router.history.canGoBack()) router.history.back();
        else void router.navigate({ to: fallback, search: {} as never });
      }}
      className={`press grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:bg-surface-2 ${className}`}
    >
      <ChevronLeft className="h-6 w-6" strokeWidth={2.1} />
    </button>
  );
}

/** Compact app bar: back · centered title · optional action. */
export function TopBar({
  title,
  fallback,
  right,
  className = "",
}: {
  title?: ReactNode;
  fallback?: Fallback;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-30 -mx-1 flex items-center justify-between gap-2 bg-background/85 px-1 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-md lg:static lg:bg-transparent lg:pt-0 lg:backdrop-blur-none ${className}`}
    >
      <BackButton fallback={fallback} />
      {title ? (
        <p className="min-w-0 flex-1 truncate text-center font-sans text-[16.5px] font-bold tracking-normal">
          {title}
        </p>
      ) : (
        <span className="flex-1" />
      )}
      <div className="flex min-w-[42px] justify-end">{right}</div>
    </header>
  );
}
