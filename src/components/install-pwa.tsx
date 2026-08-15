import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { LumiMascot } from "@/components/lumi-mascot";

const DISMISS_KEY = "bookverse:install-banner-dismissed-at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own flag for "launched from home screen"
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function recentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
}

/**
 * A small, dismissible bottom banner offering to install the app.
 *   - Chrome/Edge/Android: captures the native `beforeinstallprompt`
 *     event and triggers it on tap — a real install, home-screen icon
 *     included.
 *   - iOS Safari: has no such event (Apple doesn't expose one), so this
 *     shows the manual "Share → Add to Home Screen" steps instead.
 * Hidden entirely once the app is already running standalone, and stays
 * quiet for two weeks after being dismissed rather than nagging every visit.
 */
export function InstallPwaBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden until checks resolve, avoids a flash

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    setDismissed(false);

    if (isIos()) {
      setShowIosTip(true);
      return;
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferred(null);
  }

  if (dismissed || (!deferred && !showIosTip)) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:right-4">
      <LumiMascot size={40} blink={false} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Instale o BookVerse</p>
        {showIosTip ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Toque em <Share className="mx-0.5 inline h-3 w-3 align-[-1px]" /> Compartilhar, depois em
            "Adicionar à Tela de Início".
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Acesso rápido direto da tela inicial, sem precisar abrir o navegador.
          </p>
        )}
        {!showIosTip && (
          <button
            onClick={install}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Download className="h-3.5 w-3.5" /> Instalar
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
