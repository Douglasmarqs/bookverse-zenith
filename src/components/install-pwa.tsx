import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { LumiMascot } from "@/components/lumi-mascot";
import {
  detectInstallPlatform,
  openInstallSheet,
  useInstallPrompt,
  type InstallPlatform,
} from "@/lib/install";

const DISMISS_KEY = "bookverse:install-banner-dismissed-at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return !!raw && Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * A small, dismissible banner offering to install the app. With the
 * browser's own prompt (Chrome/Edge/Android) it installs in one tap;
 * everywhere else (iPhone, Samsung Internet, Firefox, in-app browsers) it
 * opens the step-by-step sheet for that browser. Hidden once installed,
 * and quiet for two weeks after being dismissed — the sheet stays one tap
 * away in "Você" → "Instalar o app".
 */
export function InstallPwaBanner() {
  const install = useInstallPrompt();
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);

  useEffect(() => {
    if (recentlyDismissed()) return;
    setPlatform(detectInstallPlatform());
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setPlatform(null);
  }

  if (!platform || platform === "installed") return null;
  // On computers, only when the browser can install right away.
  if ((platform === "desktop" || platform === "mac-safari") && !install.available) return null;

  const oneTap = install.available;
  const text =
    platform === "inapp"
      ? "Abra no navegador para instalar e ler em tela cheia."
      : oneTap
        ? "Tela cheia, ícone na tela inicial e livros offline."
        : "Em poucos toques: veja o passo a passo para o seu celular.";

  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:right-4 lg:bottom-4">
      <LumiMascot size={40} blink={false} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Instale o BookVerse</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
        <button
          onClick={() => {
            if (oneTap) void install.prompt().then((ok) => ok && setPlatform(null));
            else openInstallSheet();
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Download className="h-3.5 w-3.5" /> {oneTap ? "Instalar" : "Como instalar"}
        </button>
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
