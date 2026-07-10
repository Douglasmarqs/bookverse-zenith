import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Menu, X, BookOpen, LogOut, User as UserIcon } from "lucide-react";
import type { User } from "firebase/auth";
import { signOut, subscribeAuth } from "../lib/firebase";

const NAV = [
  { label: "Início", to: "/" },
  { label: "Descobrir", to: "/" },
  { label: "Minha biblioteca", to: "/" },
  { label: "Ranking", to: "/" },
  { label: "IA", to: "/" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => subscribeAuth(setUser), []);

  const isSignedIn = !!user && !user.isAnonymous;
  const initial =
    (user?.displayName || user?.email || "?").trim().charAt(0).toUpperCase() || "U";

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-border/60 backdrop-blur-xl bg-background/70"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/40 transition-transform group-hover:scale-105">
            <BookOpen className="h-4 w-4 text-gold" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Book<span className="text-gold">verse</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center justify-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="relative rounded-full px-4 py-2 text-sm text-foreground/75 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            aria-label="Buscar"
            className="hidden md:grid h-10 w-10 place-items-center rounded-full border border-border/60 text-foreground/80 hover:text-gold hover:border-gold/40 transition"
          >
            <Search className="h-4 w-4" />
          </button>

          {isSignedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Conta"
                className="grid h-10 w-10 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/40 text-sm font-semibold text-gold hover:bg-gold/20"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initial
                )}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">
                      {user?.displayName || "Leitor"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <div className="my-1 h-px bg-border/60" />
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="hidden md:inline-flex items-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Entrar
            </Link>
          )}

          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-full border border-border/60"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
            {isSignedIn ? (
              <button
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium"
              >
                <UserIcon className="h-4 w-4" /> Sair ({user?.email})
              </button>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
