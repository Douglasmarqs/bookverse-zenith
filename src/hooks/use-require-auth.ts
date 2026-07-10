/**
 * Client-side auth guard. Redirects to /auth when the current user is not
 * signed in (anonymous users are treated as unauthenticated).
 */
import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { User } from "firebase/auth";
import { subscribeAuth } from "@/lib/firebase";

export type AuthGuardState = "loading" | "authenticated" | "unauthenticated";

export function useRequireAuth(): { state: AuthGuardState; user: User | null } {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.href });
  const [state, setState] = useState<AuthGuardState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      if (u && !u.isAnonymous) {
        setUser(u);
        setState("authenticated");
      } else {
        setUser(null);
        setState("unauthenticated");
        navigate({
          to: "/auth",
          search: { redirect: pathname },
          replace: true,
        });
      }
    });
    return unsub;
  }, [navigate, pathname]);

  return { state, user };
}
