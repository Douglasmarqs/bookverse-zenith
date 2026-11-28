/**
 * Installing the app: the browser's install prompt (captured once for the
 * whole app), where we are (browser/OS) and a way to open the install
 * sheet from anywhere.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/* ── Install prompt, captured once for the whole app ─────────────────── */

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
    toast.success("BookVerse instalado! Abra pelo ícone na tela inicial.");
  });
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    available: !!deferred,
    async prompt(): Promise<boolean> {
      if (!deferred) return false;
      const d = deferred;
      await d.prompt();
      const { outcome } = await d.userChoice;
      deferred = null;
      notify();
      return outcome === "accepted";
    },
  };
}

/* ── Where are we? ───────────────────────────────────────────────────── */

export type InstallPlatform =
  | "installed"
  | "inapp"
  | "ios-safari-26"
  | "ios-safari"
  | "ios-chrome"
  | "ios-firefox"
  | "android-samsung"
  | "android-firefox"
  | "android"
  | "mac-safari"
  | "desktop";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  if (isStandalone()) return "installed";
  const ua = navigator.userAgent;
  if (
    /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|Snapchat|Pinterest|LinkedInApp/i.test(ua)
  )
    return "inapp";
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;
  if (ios) {
    if (/CriOS|EdgiOS/.test(ua)) return "ios-chrome";
    if (/FxiOS/.test(ua)) return "ios-firefox";
    const v = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    return v >= 26 ? "ios-safari-26" : "ios-safari";
  }
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/Firefox/.test(ua)) return "android-firefox";
    return "android";
  }
  if (/Macintosh/.test(ua) && /Version\/\d+.*Safari/.test(ua) && !/Chrome|Edg/.test(ua))
    return "mac-safari";
  return "desktop";
}

/* ── Global open/close ───────────────────────────────────────────────── */

export const INSTALL_OPEN_EVENT = "bookverse:install-open";
export function openInstallSheet() {
  window.dispatchEvent(new Event(INSTALL_OPEN_EVENT));
}
