/**
 * Client-side auth guard. Redirects to /auth when the current user is not
 * signed in (anonymous users are treated as unauthenticated).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { User } from "firebase/auth";
import { subscribeAuth } from "@/lib/firebase";

export type AuthGuardState = "loading" | "authenticated" | "unauthenticated";

export function useRequireAuth(): { state: AuthGuardState; user: User | null } {
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  // The page that asked for sign-in, captured once. Reading it through a ref
  // keeps the auth subscription from re-running (and re-redirecting) while
  // the router is already on its way to /auth — which previously nested
  // `?redirect=/auth?redirect=…` dozens of times.
  const originRef = useRef(href);
  const redirectedRef = useRef(false);
  const [state, setState] = useState<AuthGuardState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      if (u && !u.isAnonymous) {
        redirectedRef.current = false;
        setUser(u);
        setState("authenticated");
        return;
      }
      setUser(null);
      setState("unauthenticated");
      if (redirectedRef.current) return;
      const origin = originRef.current;
      if (origin.startsWith("/auth")) return;
      redirectedRef.current = true;
      navigate({ to: "/auth", search: { redirect: origin }, replace: true, viewTransition: false });
    });
    return unsub;
  }, [navigate]);

  return { state, user };
}
