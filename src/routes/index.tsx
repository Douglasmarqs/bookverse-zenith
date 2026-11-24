import { createFileRoute } from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";

import { LandingPage } from "@/components/landing/landing-page";
import { HomeScreen } from "@/components/home/home-screen";
import { SESSION_HINT_KEY, useAuthState } from "@/hooks/use-auth-user";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BookVerse — todo livro, a um toque" },
      {
        name: "description",
        content:
          "Milhares de clássicos gratuitos, seus EPUBs e PDFs e um leitor confortável com metas, diário e a Lumi, sua IA de leitura.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, ready } = useAuthState();
  const signedIn = Boolean(user && !user.isAnonymous);
  const [expectSession, setExpectSession] = useState(false);

  // Runs before paint on the client; the server always renders the landing.
  useLayoutEffect(() => {
    try {
      setExpectSession(localStorage.getItem(SESSION_HINT_KEY) === "1");
    } catch {
      // storage unavailable — fall back to the landing until auth resolves
    }
  }, []);

  if (signedIn && user) return <HomeScreen user={user} />;
  if (!ready && expectSession) return <DashboardSkeleton />;
  return <LandingPage />;
}

function DashboardSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl px-5 pt-6 lg:px-10 lg:pt-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
      <div className="mt-3 h-9 w-72 animate-pulse rounded-lg bg-secondary" />
      <div className="mt-6 grid gap-3 lg:grid-cols-[1.6fr_1fr] lg:gap-5">
        <div className="h-72 animate-pulse rounded-[30px] bg-secondary/70" />
        <div className="h-72 animate-pulse rounded-[30px] bg-secondary/50" />
      </div>
      <span className="sr-only">Carregando sua estante…</span>
    </div>
  );
}
