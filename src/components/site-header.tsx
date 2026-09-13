import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Menu, X, BookOpen, LogOut, Settings, Sparkles, UserRound } from "lucide-react";
import type { User } from "firebase/auth";
import { signOut, subscribeAuth } from "../lib/firebase";
import { ensureUserProfile, subscribeUserProfile, type UserProfile } from "../lib/user-profile";
import { openLumiPanel } from "../lib/lumi-panel-store";
import { UserAvatar } from "./user-avatar";
import { ThemeSwitcher } from "./theme-switcher";
import { toast } from "sonner";

const NAV = [
  { label: "Início", to: "/" as const },
  { label: "Descobrir", to: "/descobrir" as const },
  { label: "Minha biblioteca", to: "/biblioteca" as const },
  { label: "Diário", to: "/diario" as const },
  { label: "Desafios", to: "/desafios" as const },
  { label: "Ranking", to: "/ranking" as const },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(
    () =>
      subscribeAuth((u) => {
        setUser(u);
        if (u && !u.isAnonymous) void ensureUserProfile(u);
      }),
    [],
  );

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setProfile(null);
      setProfileReady(false);
      return;
    }
    setProfileReady(false);
    return subscribeUserProfile(user.uid, (nextProfile) => {
      setProfile(nextProfile);
      setProfileReady(true);
    });
  }, [user]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchValue.trim();
    setSearchOpen(false);
    navigate({ to: "/descobrir", search: { q: q || undefined, categoria: undefined } });
  }

  const isSignedIn = !!user && !user.isAnonymous;

  async function handleSignOut() {
    setMenuOpen(false);
    try {
      await signOut();
    } catch {
      toast.error("Não foi possível sair agora. Tente novamente.");
    }
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-border/80 bg-background/92 shadow-sm backdrop-blur-xl"
          : "bg-background/78 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 md:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-primary-foreground shadow-lg shadow-gold/20 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
            <BookOpen className="h-[18px] w-[18px]" />
          </span>
          <span className="font-display text-[1.35rem] font-semibold tracking-tight text-foreground">
            Book<span className="text-gold">Verse</span>
          </span>
        </Link>

        <nav
          className="hidden lg:flex items-center justify-center gap-0.5"
          aria-label="Navegação principal"
        >
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              activeProps={{
                className:
                  "relative rounded-lg bg-gold/10 px-3 py-2 text-sm font-semibold text-gold",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            {searchOpen ? (
              <form onSubmit={submitSearch} className="flex items-center">
                <input
                  autoFocus
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onBlur={() => !searchValue && setSearchOpen(false)}
                  placeholder="Buscar livros, autores…"
                  className="h-10 w-56 rounded-xl border border-gold/35 bg-card px-4 text-sm shadow-sm outline-none"
                />
              </form>
            ) : (
              <button
                aria-label="Buscar"
                onClick={() => setSearchOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-gold"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => openLumiPanel()}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-gold"
          >
            <Sparkles className="h-3.5 w-3.5" /> Lumi
          </button>

          <ThemeSwitcher />

          {isSignedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Conta"
                className="rounded-full ring-2 ring-transparent transition hover:opacity-90 hover:ring-gold/30"
              >
                <UserAvatar
                  profile={profile}
                  user={user}
                  size="md"
                  allowProviderFallback={profileReady}
                />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">
                      {profile?.displayName || user?.displayName || "Leitor"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <div className="my-1 h-px bg-border/60" />
                  <Link
                    to="/perfil"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <Settings className="h-4 w-4" /> Meu perfil
                  </Link>
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
              search={{ redirect: undefined }}
              className="hidden md:inline-flex items-center rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-gold/20 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/25 active:translate-y-0"
            >
              Entrar
            </Link>
          )}

          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-secondary"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            <form
              onSubmit={(e) => {
                submitSearch(e);
                setOpen(false);
              }}
              className="mb-2"
            >
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Buscar livros, autores…"
                className="w-full rounded-full border border-border bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-gold/60"
              />
            </form>
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
            <button
              onClick={() => {
                setOpen(false);
                openLumiPanel();
              }}
              className="rounded-lg px-3 py-3 text-left text-sm hover:bg-secondary"
            >
              IA
            </button>
            {isSignedIn ? (
              <>
                <Link
                  to="/perfil"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm hover:bg-secondary"
                >
                  Meu perfil
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium"
                >
                  <UserRound className="h-4 w-4" /> Sair ({user?.email})
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                search={{ redirect: undefined }}
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
