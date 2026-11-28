/**
 * "Instalar o app" — the right steps for this phone and browser.
 *
 *  - Chrome/Edge (Android, desktop): the native install prompt, one tap.
 *  - Android without the prompt (Samsung Internet, Firefox, Chrome before
 *    it offers one): where the menu item is.
 *  - iPhone/iPad: Safari has no install prompt, so the steps are drawn as
 *    the buttons you'll actually see — the iOS 26 layout (••• → Compartilhar
 *    → Adicionar à Tela de Início) and the older one (Compartilhar at the
 *    bottom), plus Chrome/Edge/Firefox on iOS.
 *  - In-app browsers (Instagram, Facebook, TikTok…) can't install at all:
 *    it says so and offers to copy the link to open in the browser.
 *
 * Open it from anywhere with `openInstallSheet()` (lib/install).
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Download,
  EllipsisVertical,
  Menu,
  MoreHorizontal,
  PlusSquare,
  Share,
  ToggleRight,
  WifiOff,
  X,
  Maximize2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Lumi } from "@/components/brand/lumi";
import {
  INSTALL_OPEN_EVENT,
  detectInstallPlatform,
  useInstallPrompt,
  type InstallPlatform,
} from "@/lib/install";

/* ── The steps ───────────────────────────────────────────────────────── */

/** A drawing of the button to look for. */
function Key({ children, label }: { children?: ReactNode; label?: string }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-card px-2.5 align-middle text-[13px] font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border)]">
      {children}
      {label}
    </span>
  );
}

interface Step {
  key: ReactNode;
  text: ReactNode;
}

function stepsFor(
  p: InstallPlatform,
  iPad: boolean,
): { title: string; steps: Step[]; note?: string } {
  const where = iPad ? "no topo, ao lado do endereço" : "na barra do Safari, embaixo";
  switch (p) {
    case "ios-safari-26":
      return {
        title: "No Safari do iPhone",
        steps: [
          {
            key: (
              <Key>
                <MoreHorizontal className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque nos <b>três pontinhos</b> {where}, à direita do endereço.
              </>
            ),
          },
          {
            key: (
              <Key label="Compartilhar">
                <Share className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque em <b>Compartilhar</b>.
              </>
            ),
          },
          {
            key: (
              <Key label="Adicionar à Tela de Início">
                <PlusSquare className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Role a lista e toque em <b>Adicionar à Tela de Início</b> (se não aparecer, toque em{" "}
                <b>Ver Mais</b>).
              </>
            ),
          },
          {
            key: (
              <Key label="Adicionar">
                <ToggleRight className="h-4 w-4 text-[#34c759]" />
              </Key>
            ),
            text: (
              <>
                Deixe <b>Abrir como App Web</b> ligado e toque em <b>Adicionar</b>, no canto de
                cima.
              </>
            ),
          },
        ],
      };
    case "ios-safari":
      return {
        title: iPad ? "No Safari do iPad" : "No Safari do iPhone",
        steps: [
          {
            key: (
              <Key>
                <Share className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque no botão <b>Compartilhar</b> {where}.
              </>
            ),
          },
          {
            key: (
              <Key label="Adicionar à Tela de Início">
                <PlusSquare className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Role a lista e toque em <b>Adicionar à Tela de Início</b>.
              </>
            ),
          },
          {
            key: <Key label="Adicionar" />,
            text: (
              <>
                Toque em <b>Adicionar</b>, no canto de cima.
              </>
            ),
          },
        ],
      };
    case "ios-chrome":
      return {
        title: "No Chrome ou Edge do iPhone",
        steps: [
          {
            key: (
              <Key>
                <Share className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque em <b>Compartilhar</b>, no canto da barra de endereço.
              </>
            ),
          },
          {
            key: (
              <Key label="Adicionar à Tela de Início">
                <PlusSquare className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.
              </>
            ),
          },
        ],
        note: "Se não aparecer a opção, abra este site no Safari — é o jeito mais garantido no iPhone.",
      };
    case "ios-firefox":
      return {
        title: "No Firefox do iPhone",
        steps: [
          {
            key: (
              <Key>
                <Menu className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque no <b>menu</b> (três linhas) e em <b>Compartilhar</b>.
              </>
            ),
          },
          {
            key: (
              <Key label="Adicionar à Tela de Início">
                <PlusSquare className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.
              </>
            ),
          },
        ],
      };
    case "android-samsung":
      return {
        title: "No Samsung Internet",
        steps: [
          {
            key: (
              <Key>
                <Menu className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque no <b>menu</b> (três linhas), na barra de baixo.
              </>
            ),
          },
          {
            key: <Key label="Adicionar página a" />,
            text: (
              <>
                Toque em <b>Adicionar página a</b> → <b>Tela inicial</b> (ou em <b>Instalar</b>, se
                aparecer).
              </>
            ),
          },
        ],
      };
    case "android-firefox":
      return {
        title: "No Firefox do Android",
        steps: [
          {
            key: (
              <Key>
                <EllipsisVertical className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque nos <b>três pontinhos</b> do navegador.
              </>
            ),
          },
          {
            key: (
              <Key label="Instalar">
                <Smartphone className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque em <b>Instalar</b> (ou <b>Adicionar à tela inicial</b>).
              </>
            ),
          },
        ],
      };
    case "android":
      return {
        title: "No Chrome do Android",
        steps: [
          {
            key: (
              <Key>
                <EllipsisVertical className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque nos <b>três pontinhos</b>, no canto de cima.
              </>
            ),
          },
          {
            key: (
              <Key label="Instalar app">
                <Smartphone className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>) e confirme.
              </>
            ),
          },
        ],
      };
    case "mac-safari":
      return {
        title: "No Safari do Mac",
        steps: [
          {
            key: <Key label="Arquivo" />,
            text: (
              <>
                No menu <b>Arquivo</b>, escolha <b>Adicionar ao Dock</b>.
              </>
            ),
          },
        ],
      };
    default:
      return {
        title: "No navegador do computador",
        steps: [
          {
            key: (
              <Key>
                <Download className="h-4 w-4" />
              </Key>
            ),
            text: (
              <>
                Clique no ícone de <b>instalar</b>, no fim da barra de endereço (Chrome ou Edge).
              </>
            ),
          },
          {
            key: <Key label="Instalar" />,
            text: (
              <>
                Confirme em <b>Instalar</b>.
              </>
            ),
          },
        ],
      };
  }
}

/* ── The sheet ───────────────────────────────────────────────────────── */

export function InstallSheet() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [iPad, setIPad] = useState(false);
  const install = useInstallPrompt();

  useEffect(() => {
    const onOpen = () => {
      setPlatform(detectInstallPlatform());
      const ua = navigator.userAgent;
      setIPad(/iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1));
      setOpen(true);
    };
    window.addEventListener(INSTALL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(INSTALL_OPEN_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const guide = stepsFor(platform, iPad);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copiado. Cole no Safari ou no Chrome para instalar.");
    } catch {
      toast.message(window.location.origin);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-label="Instalar o BookVerse"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-h-[90dvh] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-t-[30px] bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-2xl lg:bottom-6 lg:rounded-[30px]"
          >
            <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-foreground/15" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-[16px] bg-surface-2">
                  <img src="/icons/icon-192.png" alt="" className="h-full w-full" />
                </span>
                <div>
                  <p className="font-display text-[22px] leading-tight">Instale o BookVerse</p>
                  <p className="text-[13px] text-muted-foreground">Grátis · leva 10 segundos</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11.5px] font-semibold">
              {(
                [
                  [Maximize2, "Tela cheia, sem barra do navegador"],
                  [Smartphone, "Ícone na tela inicial"],
                  [WifiOff, "Livros baixados offline"],
                ] as const
              ).map(([Icon, label]) => (
                <div key={label} className="rounded-[16px] bg-accent-soft/70 px-2 py-3">
                  <Icon className="mx-auto mb-1.5 h-5 w-5 text-gold" />
                  {label}
                </div>
              ))}
            </div>

            {platform === "installed" ? (
              <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-surface-2 p-4">
                <Check className="h-5 w-5 text-[#1f8a52]" />
                <p className="text-[14px]">Você já está usando o app instalado. 🎉</p>
              </div>
            ) : platform === "inapp" ? (
              <div className="mt-5 rounded-[18px] bg-surface-2 p-4">
                <p className="text-[14.5px] font-semibold">Abra no navegador primeiro</p>
                <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">
                  Este navegador dentro do app (Instagram, Facebook, TikTok…) não instala sites.
                  Toque nos <b>três pontinhos</b> e em <b>Abrir no navegador</b> (ou{" "}
                  <b>Abrir no Safari</b>) — ou copie o link:
                </p>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="press mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-[13.5px] font-semibold text-background"
                >
                  <Copy className="h-4 w-4" /> Copiar link
                </button>
              </div>
            ) : install.available ? (
              <button
                type="button"
                onClick={() =>
                  void install.prompt().then((ok) => {
                    if (ok) setOpen(false);
                  })
                }
                className="press mt-5 flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gold text-[16px] font-semibold text-primary-foreground"
              >
                <Download className="h-5 w-5" /> Instalar agora
              </button>
            ) : (
              <>
                <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {guide.title}
                </p>
                <ol className="space-y-2">
                  {guide.steps.map((s, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.12 + i * 0.07,
                        duration: 0.4,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="flex items-start gap-3 rounded-[18px] bg-surface-2/70 p-3"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-bold text-background">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] leading-snug">{s.text}</span>
                        <span className="mt-2 flex">{s.key}</span>
                      </span>
                    </motion.li>
                  ))}
                </ol>
                {guide.note && (
                  <p className="mt-3 text-[12.5px] leading-snug text-muted-foreground">
                    {guide.note}
                  </p>
                )}
              </>
            )}

            {platform !== "installed" && (
              <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-surface-2 p-3.5">
                <Lumi pose="idle" size={44} shadow={false} />
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  Depois, abra sempre pelo ícone na tela inicial — sua conta, biblioteca e progresso
                  continuam os mesmos.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
