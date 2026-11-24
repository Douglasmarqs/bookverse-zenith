import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import {
  BookOpen,
  Compass,
  Feather,
  Flame,
  LampDesk,
  LibraryBig,
  LogIn,
  Menu,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import { haptic } from "@/components/motion/interactive";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { DISCOVER_SEARCH, getLastBook, isNavActive } from "@/lib/nav";

const MORE = [
  { to: "/diario", label: "Diário", icon: Feather },
  { to: "/metas", label: "Jornada", icon: Flame, also: ["/desafios"] },
  { to: "/ranking", label: "Clube", icon: Users },
  { to: "/perfil", label: "Perfil", icon: UserRound },
] as const;

function DockItem({
  active,
  label,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  icon: typeof Compass;
}) {
  return (
    <>
      <span className="relative grid h-8 w-12 place-items-center">
        {active && (
          <motion.span
            layoutId="dock-active"
            className="absolute inset-0 rounded-full bg-gold/15"
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
          />
        )}
        <Icon className="relative h-[20px] w-[20px]" />
      </span>
      {label}
    </>
  );
}

/**
 * Thumb-reachable navigation on phones and tablets. The raised centre
 * button reopens the last book — reading is always one tap away.
 */
export function Dock({ signedIn }: { signedIn: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const item = (active: boolean) =>
    `press flex flex-1 flex-col items-center gap-0.5 py-1 text-[10.5px] font-medium transition-colors ${
      active ? "text-gold" : "text-muted-foreground"
    }`;

  function openReader() {
    haptic();
    const last = getLastBook();
    if (last) void navigate({ to: "/reader/$bookId", params: { bookId: last } });
    else void navigate({ to: "/descobrir", search: DISCOVER_SEARCH });
  }

  const moreActive = MORE.some((m) => isNavActive(pathname, m));

  return (
    <>
      <nav
        aria-label="Navegação"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-[1.6rem] border border-border bg-background/85 px-1 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.7)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-md items-center">
          <Link to="/" className={item(pathname === "/")} onClick={() => haptic(5)}>
            <DockItem active={pathname === "/"} label="Início" icon={LampDesk} />
          </Link>
          <Link
            to="/descobrir"
            search={DISCOVER_SEARCH}
            className={item(isNavActive(pathname, { to: "/descobrir", also: ["/livro"] }))}
            onClick={() => haptic(5)}
          >
            <DockItem
              active={isNavActive(pathname, { to: "/descobrir", also: ["/livro"] })}
              label="Descobrir"
              icon={Compass}
            />
          </Link>
          {signedIn ? (
            <>
              <div className="flex flex-1 justify-center">
                <button
                  type="button"
                  onClick={openReader}
                  aria-label="Continuar lendo"
                  className="press -mt-8 grid h-14 w-14 place-items-center rounded-full border-4 border-background bg-[linear-gradient(160deg,var(--gold-soft),var(--oxide))] text-primary-foreground shadow-[0_12px_26px_-8px_color-mix(in_oklab,var(--gold)_80%,transparent)]"
                >
                  <BookOpen className="h-6 w-6" />
                </button>
              </div>
              <Link
                to="/biblioteca"
                className={item(pathname.startsWith("/biblioteca"))}
                onClick={() => haptic(5)}
              >
                <DockItem
                  active={pathname.startsWith("/biblioteca")}
                  label="Estante"
                  icon={LibraryBig}
                />
              </Link>
              <button type="button" onClick={() => setMoreOpen(true)} className={item(moreActive)}>
                <DockItem active={moreActive} label="Mais" icon={Menu} />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => openLumiPanel()} className={item(false)}>
                <DockItem active={false} label="Lumi" icon={Sparkles} />
              </button>
              <Link
                to="/auth"
                search={{ redirect: undefined }}
                className={item(pathname === "/auth")}
              >
                <DockItem active={pathname === "/auth"} label="Entrar" icon={LogIn} />
              </Link>
            </>
          )}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[2rem] border-border bg-background/95 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
        >
          <SheetHeader>
            <SheetTitle className="font-display text-3xl font-normal">Mais</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MORE.map((m, i) => (
              <motion.div
                key={m.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, type: "spring", stiffness: 400, damping: 30 }}
              >
                <Link
                  to={m.to}
                  onClick={() => setMoreOpen(false)}
                  className="press flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-medium transition hover:border-gold/40"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/12 text-gold">
                    <m.icon className="h-5 w-5" />
                  </span>
                  {m.label}
                </Link>
              </motion.div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              openLumiPanel();
            }}
            className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/30 bg-gold/10 py-3 text-sm font-semibold text-gold"
          >
            <Sparkles className="h-4 w-4" /> Falar com a Lumi
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
