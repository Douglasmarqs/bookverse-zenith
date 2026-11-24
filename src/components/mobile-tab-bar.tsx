import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Compass,
  Home,
  Library,
  LogIn,
  Medal,
  Menu,
  NotebookPen,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";

import { useAuthUser } from "@/hooks/use-auth-user";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { DISCOVER_SEARCH } from "@/lib/nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const tab =
  "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors";

/**
 * Thumb-reachable primary navigation on phones and small tablets — the
 * pattern people already know from reading apps. Hidden at lg and up,
 * where the header nav takes over.
 */
export function MobileTabBar() {
  const user = useAuthUser();
  const signedIn = !!user && !user.isAnonymous;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  const is = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  const cls = (active: boolean) =>
    `${tab} ${active ? "text-gold" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <>
      <nav
        aria-label="Navegação"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 px-2 pt-1.5 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          <Link to="/" className={cls(is("/"))} aria-current={is("/") ? "page" : undefined}>
            <TabIcon active={is("/")}>
              <Home className="h-5 w-5" />
            </TabIcon>
            Início
          </Link>
          <Link
            to="/descobrir"
            search={DISCOVER_SEARCH}
            className={cls(is("/descobrir"))}
            aria-current={is("/descobrir") ? "page" : undefined}
          >
            <TabIcon active={is("/descobrir")}>
              <Compass className="h-5 w-5" />
            </TabIcon>
            Descobrir
          </Link>
          {signedIn ? (
            <>
              <Link
                to="/biblioteca"
                className={cls(is("/biblioteca"))}
                aria-current={is("/biblioteca") ? "page" : undefined}
              >
                <TabIcon active={is("/biblioteca")}>
                  <Library className="h-5 w-5" />
                </TabIcon>
                Biblioteca
              </Link>
              <button type="button" onClick={() => openLumiPanel()} className={cls(false)}>
                <TabIcon active={false}>
                  <Sparkles className="h-5 w-5" />
                </TabIcon>
                Lumi
              </button>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cls(["/diario", "/metas", "/desafios", "/ranking", "/perfil"].some(is))}
                aria-haspopup="dialog"
              >
                <TabIcon
                  active={["/diario", "/metas", "/desafios", "/ranking", "/perfil"].some(is)}
                >
                  <Menu className="h-5 w-5" />
                </TabIcon>
                Mais
              </button>
            </>
          ) : (
            <>
              <Link to="/ranking" className={cls(is("/ranking"))}>
                <TabIcon active={is("/ranking")}>
                  <Trophy className="h-5 w-5" />
                </TabIcon>
                Ranking
              </Link>
              <Link to="/auth" search={{ redirect: undefined }} className={cls(is("/auth"))}>
                <TabIcon active={is("/auth")}>
                  <LogIn className="h-5 w-5" />
                </TabIcon>
                Entrar
              </Link>
            </>
          )}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle className="font-display text-xl">Mais</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                { to: "/diario", label: "Diário", icon: <NotebookPen className="h-5 w-5" /> },
                { to: "/metas", label: "Metas", icon: <Target className="h-5 w-5" /> },
                { to: "/desafios", label: "Desafios", icon: <Medal className="h-5 w-5" /> },
                { to: "/ranking", label: "Ranking", icon: <Trophy className="h-5 w-5" /> },
                { to: "/perfil", label: "Perfil", icon: <UserRound className="h-5 w-5" /> },
              ] as const
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 text-sm font-medium transition hover:border-gold/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/12 text-gold">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TabIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`grid h-7 w-12 place-items-center rounded-full transition-all duration-300 ${
        active ? "bg-gold/15 scale-105" : ""
      }`}
    >
      {children}
    </span>
  );
}
