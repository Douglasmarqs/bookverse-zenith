import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isFirebaseConfigured } from "../lib/firebase";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { LumiPanel } from "../components/lumi-panel";
import { Toaster } from "../components/ui/sonner";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BookVerse — Sua biblioteca literária premium" },
      {
        name: "description",
        content:
          "Descubra, leia e organize livros em uma experiência editorial premium. Leitor imersivo, progresso sincronizado, recomendações inteligentes.",
      },
      { name: "author", content: "BookVerse" },
      { name: "theme-color", content: "#0E0B08" },
      // iOS doesn't read the web manifest for "Add to Home Screen" — these
      // three meta tags are what make it install as a standalone app with
      // the right icon/status bar there instead of just a bookmark.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "BookVerse" },
      { property: "og:title", content: "BookVerse — Sua biblioteca literária premium" },
      {
        property: "og:description",
        content: "Uma experiência editorial de leitura, para todos os seus livros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/icons/favicon-16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
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
    <html lang="pt-BR" className="dark">
      <head>
        {/* Applied synchronously, before hydration, so switching to
            Light/Sepia/Paper doesn't flash the dark theme first on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('bookverse:theme');if(t&&t!=='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
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

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <ConfigBanner />
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
        <LumiPanel />
        <Toaster position="bottom-center" theme="dark" richColors />
      </div>
    </QueryClientProvider>
  );
}
