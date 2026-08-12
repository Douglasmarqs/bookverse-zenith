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
let current: User | null = null;
let started = false;
const listeners = new Set<(u: User | null) => void>();

function start() {
  if (started) return;
  started = true;
  subscribeAuth((u) => {
    current = u;
    listeners.forEach((l) => l(u));
  });
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
