import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LogIn, Search } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { MiniPlayer } from "@/components/shell/mini-player";
import { openCommandPalette } from "@/lib/command-palette-store";
import { DESKTOP_NAV, DESKTOP_SECONDARY, DISCOVER_SEARCH, isNavActive } from "@/lib/nav";
import { useAuthState } from "@/hooks/use-auth-user";

/** Desktop navigation: brand, search, the four destinations and "Lendo agora". */
export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuthState();
  const signedIn = Boolean(user && !user.isAnonymous);
  return (
    <aside className="vt-sidebar fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col overflow-y-auto overscroll-contain border-r border-border bg-card px-4 py-5 [scrollbar-width:thin] lg:flex">
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
              data-fly-target={item.to === "/biblioteca" ? "biblioteca" : undefined}
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
      <div className="mx-3 mt-5 h-px bg-border" />
      <nav aria-label="Mais" className="mt-3 flex flex-col gap-0.5">
        {DESKTOP_SECONDARY.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              search={item.to === "/adicionar" ? ({} as never) : undefined}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors ${
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-[17px] w-[17px]" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="min-h-4 flex-1" />
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
