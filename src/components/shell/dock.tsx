import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import { haptic } from "@/components/motion/interactive";
import { MiniPlayer } from "@/components/shell/mini-player";
import { DISCOVER_SEARCH, MEMBER_NAV, isNavActive } from "@/lib/nav";

/**
 * Phone and tablet navigation: four thumb-reachable tabs, with the
 * "Lendo agora" bar stacked on top so the book is always one tap away.
 */
export function Dock({ showMini = true }: { showMini?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The tapped tab lights up instantly, before the new page has rendered.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [pathname]);
  return (
    <div className="vt-dock pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden">
      {/* Fades the page out under the bar so text never collides with it. */}
      <div className="absolute inset-x-[-12px] -bottom-6 -top-16 -z-10 bg-gradient-to-b from-transparent via-background/85 to-background" />
      <div className="pointer-events-auto mx-auto flex max-w-md flex-col gap-2">
        {showMini && <MiniPlayer />}
        <nav
          aria-label="Navegação"
          className="glass-bar flex h-[66px] items-center justify-around rounded-[26px] px-2"
        >
          {MEMBER_NAV.map((item) => {
            const active = tapped ? tapped === item.to : isNavActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                search={item.to === "/descobrir" ? DISCOVER_SEARCH : undefined}
                onPointerDown={() => setTapped(item.to)}
                onClick={() => {
                  haptic(5);
                  setTapped(item.to);
                }}
                aria-current={active ? "page" : undefined}
                className={`press relative flex min-w-0 max-w-[84px] flex-1 flex-col items-center gap-1 py-2 text-[10.5px] font-semibold transition-colors ${
                  active ? "text-foreground" : "text-faint"
                }`}
              >
                <span className="relative grid h-[26px] w-[42px] place-items-center">
                  {active && (
                    <motion.span
                      layoutId="dock-glow"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                      className="absolute inset-0 rounded-full bg-accent-soft"
                    />
                  )}
                  <motion.span
                    key={active ? "on" : "off"}
                    initial={active ? { scale: 0.7, y: 2 } : false}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 18 }}
                    className="relative"
                  >
                    <Icon
                      className={`h-[21px] w-[21px] ${active ? "text-gold" : ""}`}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                  </motion.span>
                </span>
                <span className="relative truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
