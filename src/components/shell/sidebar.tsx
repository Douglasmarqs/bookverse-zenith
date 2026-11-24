import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LogIn, Search } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { MiniPlayer } from "@/components/shell/mini-player";
import { openCommandPalette } from "@/lib/command-palette-store";
import { DESKTOP_NAV, DISCOVER_SEARCH, isNavActive } from "@/lib/nav";
import { useAuthState } from "@/hooks/use-auth-user";

/** Desktop navigation: brand, search, the four destinations and "Lendo agora". */
export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuthState();
  const signedIn = Boolean(user && !user.isAnonymous);
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-border bg-card px-4 py-5 lg:flex">
      <div className="px-2">
        <Logo size={30} />
      </div>
      <button
        type="button"
        onClick={openCommandPalette}
        className="mt-6 flex h-11 items-center gap-2.5 whitespace-nowrap rounded-[14px] bg-secondary px-3 text-sm text-faint transition hover:text-foreground"
      >
        <Search className="h-[17px] w-[17px]" />
        Buscar
        <kbd className="ml-auto rounded-md bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <nav aria-label="Navegação" className="mt-5 flex flex-col gap-0.5">
        {DESKTOP_NAV.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              search={item.to === "/descobrir" ? DISCOVER_SEARCH : undefined}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold transition-colors ${
                active
                  ? "text-background"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="side-active"
                  className="absolute inset-0 rounded-[14px] bg-foreground"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <Icon className="relative h-[19px] w-[19px]" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      {!signedIn && (
        <Link
          to="/auth"
          search={{ redirect: pathname }}
          className="press mb-3 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold"
        >
          <LogIn className="h-4 w-4" /> Entrar ou criar conta
        </Link>
      )}
      <MiniPlayer compact />
    </aside>
  );
}
