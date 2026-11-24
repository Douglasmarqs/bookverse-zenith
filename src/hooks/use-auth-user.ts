import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeAuth } from "@/lib/firebase";

/**
 * Shared auth state.
 *
 * Every book card used to open its own `onAuthStateChanged` listener, so a
 * shelf page created 60+ Firebase listeners and 60+ re-render cascades on
 * each auth tick. This keeps exactly one listener per session and fans the
 * value out to all subscribers.
 */
/** Set while a reader is signed in, so a returning reader sees a calm
 * skeleton (not a flash of the marketing page) while Firebase restores the
 * session from IndexedDB. */
export const SESSION_HINT_KEY = "bookverse:had-session";

let current: User | null = null;
let resolved = false;
let started = false;
const listeners = new Set<(u: User | null) => void>();
const readyListeners = new Set<(ready: boolean) => void>();

function start() {
  if (started) return;
  started = true;
  subscribeAuth((u) => {
    current = u;
    resolved = true;
    try {
      if (u && !u.isAnonymous) localStorage.setItem(SESSION_HINT_KEY, "1");
      else localStorage.removeItem(SESSION_HINT_KEY);
    } catch {
      // storage unavailable — the hint is only a cosmetic optimisation
    }
    listeners.forEach((l) => l(u));
    readyListeners.forEach((l) => l(true));
  });
}

/** Like useAuthUser, plus `ready` — false until Firebase reports the first
 * auth state, so pages can avoid flashing signed-out UI to signed-in readers. */
export function useAuthState(): { user: User | null; ready: boolean } {
  const user = useAuthUser();
  const [ready, setReady] = useState(resolved);
  useEffect(() => {
    start();
    setReady(resolved);
    readyListeners.add(setReady);
    // Firebase never answers when it is not configured; don't hang forever.
    const timer = setTimeout(() => setReady(true), 2500);
    return () => {
      readyListeners.delete(setReady);
      clearTimeout(timer);
    };
  }, []);
  return { user, ready };
}

export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(current);
  useEffect(() => {
    start();
    setUser(current);
    listeners.add(setUser);
    return () => {
      listeners.delete(setUser);
    };
  }, []);
  return user;
}

/** True once the element is (or has been) scrolled near the viewport —
 * used to defer fetching/rendering of offscreen shelves. */
export function useInView<T extends Element>(ref: React.RefObject<T | null>, rootMargin = "400px") {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, inView, rootMargin]);
  return inView;
}
