import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Search, Sparkles } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { openCommandPalette } from "@/lib/command-palette-store";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { DISCOVER_SEARCH, MEMBER_NAV, isNavActive } from "@/lib/nav";
import { AccountMenu } from "./account-menu";

/**
 * Desktop navigation for signed-in readers: a slim "spine" on the left,
 * always within reach, with a brass bookmark sliding to the active page.
 */
export function AppRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside
      aria-label="Navegação principal"
      className="fixed inset-y-0 left-0 z-50 hidden w-[84px] flex-col items-center border-r border-border bg-[linear-gradient(180deg,var(--surface),var(--ink))] py-5 lg:flex"
    >
      <Link to="/" aria-label="BookVerse — início" className="press mb-6">
        <LogoMark size={40} />
      </Link>
      <nav className="flex flex-col items-center gap-1">
        {MEMBER_NAV.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              search={(item.to === "/descobrir" ? DISCOVER_SEARCH : undefined) as never}
              aria-current={active ? "page" : undefined}
              className={`press group relative flex w-16 flex-col items-center gap-1 rounded-2xl py-2.5 text-[10.5px] font-medium transition-colors ${
                active ? "text-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="rail-active"
                  className="absolute inset-0 rounded-2xl bg-gold/10"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {active && (
                <motion.span
                  layoutId="rail-ribbon"
                  className="absolute -left-[10px] top-2.5 bottom-2.5 w-[3px] rounded-full bg-gold"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="relative h-[19px] w-[19px] transition-transform duration-300 group-hover:-translate-y-0.5" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Buscar (Ctrl+K)"
          title="Buscar (Ctrl+K)"
          className="press grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
        <ThemeSwitcher />
        <button
          type="button"
          onClick={() => openLumiPanel()}
          aria-label="Falar com a Lumi"
          title="Falar com a Lumi"
          className="press grid h-10 w-10 place-items-center rounded-full text-gold transition hover:bg-gold/10"
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </button>
        <div className="mt-2">
          <AccountMenu side="right" />
        </div>
      </div>
    </aside>
  );
}
