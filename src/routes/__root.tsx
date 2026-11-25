import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CelebrationOverlay } from "@/components/celebration-overlay";
import { useStarted } from "@/lib/nav";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/literata/wght.css";
import "@fontsource-variable/literata/wght-italic.css";
import "@fontsource/instrument-serif/400.css";

import appCss from "../styles.css?url";
import { isFirebaseConfigured } from "../lib/firebase";
import { SiteFooter } from "../components/site-footer";
import { LumiPanel } from "../components/lumi-panel";
import { InstallPwaBanner } from "../components/install-pwa";
import { Toaster } from "../components/ui/sonner";
import { CommandPalette } from "../components/command-palette";
import { Dock } from "../components/shell/dock";
import { FitGuard } from "../components/shell/fit-guard";
import { PageSway } from "../components/motion/use-sway";
import { Sidebar } from "../components/shell/sidebar";
import { SESSION_HINT_KEY, useAuthState } from "../hooks/use-auth-user";
import { THEME_BOOT_SCRIPT, applyTheme, getStoredTheme } from "../lib/theme";
import { useSiteTheme } from "../hooks/use-site-theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-gold">
          Capítulo perdido
        </p>
        <h1 className="mt-4 font-display text-7xl font-semibold">404</h1>
        <p className="mt-4 text-muted-foreground">
          A página que você procura não faz parte desta biblioteca.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Voltar à biblioteca
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  // A code file from the previous deploy: reload once into the new one.
  const stale =
    /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
      String((error as { message?: string })?.message ?? error),
    );
  useEffect(() => {
    if (!stale) return;
    try {
      if (sessionStorage.getItem("bookverse:reloaded-for-update")) return;
      sessionStorage.setItem("bookverse:reloaded-for-update", "1");
    } catch {
      // ignore
    }
    window.location.reload();
  }, [stale]);
  if (stale) return null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-semibold">
          Uma página se soltou da encadernação
        </h1>
        <p className="mt-3 text-muted-foreground">
          Algo saiu do lugar. Tente novamente ou volte à página inicial.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-medium"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "BookVerse — todo livro, a um toque" },
      {
        name: "description",
        content:
          "Milhares de clássicos grátis, seus EPUBs e PDFs, leitura e áudio no mesmo lugar — com a Lumi, sua coruja de leitura.",
      },
      { name: "author", content: "BookVerse" },
      { name: "theme-color", content: "#f4f3ef" },
      // iOS doesn't read the web manifest for "Add to Home Screen" — these
      // three meta tags are what make it install as a standalone app with
      // the right icon/status bar there instead of just a bookmark.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "BookVerse" },
      { property: "og:title", content: "BookVerse — todo livro, a um toque" },
      {
        property: "og:description",
        content: "Clássicos grátis, seus próprios livros, leitura e áudio no mesmo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/bookverse-icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="claro" suppressHydrationWarning>
      <head>
        {/* Applied synchronously, before hydration, so switching to
            Light/Sepia/Paper doesn't flash the dark theme first on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_BOOT_SCRIPT,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ConfigBanner() {
  if (isFirebaseConfigured()) return null;
  return (
    <div className="bg-destructive/15 px-4 py-2 text-center text-xs text-destructive">
      Este deploy está sem a chave <code className="font-mono">GOOGLE_API_KEY</code> do Firebase —
      login, biblioteca e ranking ficam indisponíveis até isso ser configurado (veja DEPLOY.md).
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The reader is its own full-screen (fixed inset-0) experience with its
  // own header/nav — stacking the global site chrome on top of it was
  // literally two headers overlapping at the same spot on mobile.
  // The reader and the first-run onboarding are focused, full-screen flows
  // without the app's navigation chrome.
  const isReaderRoute =
    pathname.startsWith("/reader/") || pathname === "/bem-vindo" || pathname === "/auth";

  // Page transitions are cosmetic: when the browser skips or aborts one
  // (rapid navigation, rotating the phone), don't surface it as an error.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { name?: string; message?: string } | undefined;
      if (
        reason?.name === "AbortError" ||
        reason?.name === "InvalidStateError" ||
        /Transition was (skipped|aborted)/i.test(reason?.message ?? "")
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  // "Automático" follows the OS everywhere, including inside the reader where
  // the site chrome (and its theme switcher) is not mounted.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredTheme() === "auto") applyTheme("auto", false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // After a new deploy, a phone that kept the app open may ask for code
  // files that no longer exist. Reload once into the new version instead
  // of leaving a broken screen.
  useEffect(() => {
    const KEY = "bookverse:reloaded-for-update";
    const onFail = (e: Event) => {
      try {
        if (sessionStorage.getItem(KEY)) return;
        sessionStorage.setItem(KEY, "1");
      } catch {
        // ignore
      }
      e.preventDefault();
      window.location.reload();
    };
    const onError = (e: PromiseRejectionEvent) => {
      if (
        /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
          String(e.reason?.message ?? e.reason),
        )
      ) {
        onFail(e);
      }
    };
    window.addEventListener("vite:preloadError", onFail);
    window.addEventListener("unhandledrejection", onError);
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        // ignore
      }
    }, 10_000);
    return () => {
      window.removeEventListener("vite:preloadError", onFail);
      window.removeEventListener("unhandledrejection", onError);
      clearTimeout(t);
    };
  }, []);

  // Warm up the main screens' code right after the first paint, so moving
  // between tabs never waits for a download (that wait was the blank blink).
  const router = useRouter();
  useEffect(() => {
    const warm = () => {
      for (const to of [
        "/",
        "/descobrir",
        "/biblioteca",
        "/perfil",
        "/adicionar",
        "/downloads",
        "/desafios",
        "/ajustes",
        "/auth",
      ] as const) {
        void router.preloadRoute({ to }).catch(() => {});
      }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 600);
  }, [router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[sw] registration failed", err);
      });
    }
  }, []);

  const member = useShellMode();
  // First-time visitors see the marketing landing on "/" with its own header;
  // everywhere else (and for anyone already reading) it's the app shell.
  const started = useStarted();
  const landing = pathname === "/" && !member && !started;
  // Full-screen pages (book detail, import, downloads) hide the dock.
  const fullScreen =
    pathname.startsWith("/livro/") || pathname === "/adicionar" || pathname === "/downloads";
  const appChrome = !isReaderRoute && !landing;

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`flex min-h-screen flex-col ${appChrome ? "lg:pl-[264px]" : ""}`}>
        {!isReaderRoute && <ConfigBanner />}
        {appChrome && <Sidebar />}
        <main
          className={`relative z-[1] flex-1 ${appChrome ? (fullScreen ? "pb-8 lg:pb-0" : "pb-44 lg:pb-0") : ""}`}
        >
          {/* Keyed by path so every navigation gets a gentle entrance. */}
          <div key={pathname} className={isReaderRoute ? "" : "page-enter"}>
            <Outlet />
          </div>
        </main>
        {/* On iOS (Safari 26 and installed PWAs) the page runs under the
            status bar; this strip keeps titles from sliding beneath the clock
            and battery while scrolling. Zero-height wherever there's no inset. */}
        {!isReaderRoute && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[env(safe-area-inset-top)] bg-background/90 backdrop-blur-md lg:hidden"
          />
        )}
        {landing && <SiteFooter />}
        {/* A book's page is a full-screen detail on phones (mockup 07). */}
        {appChrome && !fullScreen && <Dock showMini={pathname !== "/"} />}
        <FitGuard />
        <PageSway />
        <CommandPalette />
        {/* The reader opens Lumi with a book/selection context. It must stay
            mounted there too; only the site chrome itself is suppressed. */}
        <LumiPanel />
        <CelebrationOverlay />
        {!isReaderRoute && <InstallPwaBanner />}
        <AppToaster />
      </div>
    </QueryClientProvider>
  );
}

/** Toasts follow the resolved appearance. */
function AppToaster() {
  const [, , resolved] = useSiteTheme();
  return (
    <Toaster position="top-center" theme={resolved === "escuro" ? "dark" : "light"} richColors />
  );
}

/** Member shell (rail + dock) vs visitor shell (header + footer). A returning
 * reader gets the member shell straight away while Firebase restores the
 * session, instead of a flash of the marketing header. */
function useShellMode(): boolean {
  const { user, ready } = useAuthState();
  const [hint, setHint] = useState(false);
  useLayoutEffect(() => {
    try {
      setHint(localStorage.getItem(SESSION_HINT_KEY) === "1");
    } catch {
      // storage unavailable
    }
  }, []);
  if (user && !user.isAnonymous) return true;
  return !ready && hint;
}
