import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Magnetic } from "@/components/motion/interactive";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { openCommandPalette } from "@/lib/command-palette-store";
import { DISCOVER_SEARCH, VISITOR_NAV } from "@/lib/nav";
import { AccountMenu } from "./account-menu";

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return scrolled;
}

const glass = (scrolled: boolean) =>
  scrolled
    ? "border-b border-border bg-background/80 shadow-[0_10px_30px_-24px_rgb(0_0_0/0.6)] backdrop-blur-xl"
    : "border-b border-transparent bg-transparent";

/** Header for visitors: brand, anchor links into the landing, sign-in. */
export function VisitorHeader() {
  const scrolled = useScrolled();
  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500 ${glass(scrolled)}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:h-[4.5rem] md:px-8">
        <Logo size={34} />
        <nav aria-label="Seções" className="mx-auto hidden items-center gap-1 lg:flex">
          <Link
            to="/descobrir"
            search={DISCOVER_SEARCH}
            className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Acervo
          </Link>
          {VISITOR_NAV.map((item) => (
            <Link
              key={item.hash}
              to="/"
              hash={item.hash}
              className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Buscar"
            className="press grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <ThemeSwitcher />
          <Link
            to="/auth"
            search={{ redirect: undefined }}
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-foreground/85 transition hover:text-gold sm:inline-flex"
          >
            Entrar
          </Link>
          <Magnetic>
            <Link to="/auth" search={{ redirect: "/" }} className="btn-primary px-4 py-2.5 text-sm">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Criar estante grátis</span>
            </Link>
          </Magnetic>
        </div>
      </div>
    </header>
  );
}

/** Compact top bar for signed-in readers on phones and tablets. */
export function MemberTopBar() {
  const scrolled = useScrolled();
  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500 lg:hidden ${glass(scrolled)}`}
    >
      <div className="flex h-14 items-center gap-1 px-4">
        <Logo size={30} />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Buscar"
            className="press grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <ThemeSwitcher />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
