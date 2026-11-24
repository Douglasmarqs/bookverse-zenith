import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { Sidebar } from "../components/shell/sidebar";
import { VisitorHeader } from "../components/shell/top-bar";
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
  const landing = pathname === "/" && !member;
  const appChrome = !isReaderRoute && !landing;

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`flex min-h-screen flex-col ${appChrome ? "lg:pl-[264px]" : ""}`}>
        {!isReaderRoute && <ConfigBanner />}
        {landing && <VisitorHeader />}
        {appChrome && <Sidebar />}
        <main className={`relative z-[1] flex-1 ${appChrome ? "pb-44 lg:pb-0" : ""}`}>
          {/* Keyed by path so every navigation gets a gentle entrance. */}
          <div key={pathname} className={isReaderRoute ? "" : "page-enter"}>
            <Outlet />
          </div>
        </main>
        {landing && <SiteFooter />}
        {appChrome && <Dock showMini={pathname !== "/"} />}
        <CommandPalette />
        {/* The reader opens Lumi with a book/selection context. It must stay
            mounted there too; only the site chrome itself is suppressed. */}
        <LumiPanel />
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
