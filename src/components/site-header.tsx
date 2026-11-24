import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Search, Settings, Sparkles, UserRound } from "lucide-react";
import type { User } from "firebase/auth";
import { toast } from "sonner";

import { signOut, subscribeAuth } from "@/lib/firebase";
import { ensureUserProfile, subscribeUserProfile, type UserProfile } from "@/lib/user-profile";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { openCommandPalette } from "@/lib/command-palette-store";
import { DISCOVER_SEARCH, MEMBER_NAV, PROGRESS_NAV, VISITOR_NAV } from "@/lib/nav";
import { Logo } from "@/components/brand/logo";
import { UserAvatar } from "./user-avatar";
import { ThemeSwitcher } from "./theme-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const linkBase =
  "relative rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const linkActive = "relative rounded-full bg-gold/10 px-3.5 py-2 text-sm font-semibold text-gold";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
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

  const isSignedIn = !!user && !user.isAnonymous;
  const progressActive = PROGRESS_NAV.some((i) => pathname.startsWith(i.to));

  async function handleSignOut() {
    try {
      await signOut();
      void navigate({ to: "/" });
    } catch {
      toast.error("Não foi possível sair agora. Tente novamente.");
    }
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-500 ${
        scrolled
          ? "border-b border-border/70 bg-background/85 shadow-[0_8px_30px_-20px_rgb(10_30_70/0.35)] backdrop-blur-xl"
          : "border-b border-transparent bg-background/40 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:h-[4.5rem] md:px-8">
        <Logo size={34} className="shrink-0" />

        <nav
          className="mx-auto hidden items-center gap-0.5 rounded-full border border-border/60 bg-card/50 p-1 backdrop-blur lg:flex"
          aria-label="Navegação principal"
        >
          {isSignedIn ? (
            <>
              {MEMBER_NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  search={(item.to === "/descobrir" ? DISCOVER_SEARCH : undefined) as never}
                  activeOptions={{ exact: item.to === "/", includeSearch: false }}
                  className={linkBase}
                  activeProps={{ className: linkActive }}
                >
                  {item.label}
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`${progressActive ? linkActive : linkBase} inline-flex items-center gap-1 outline-none`}
                >
                  Progresso <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64 rounded-2xl p-2">
                  {PROGRESS_NAV.map((item) => (
                    <DropdownMenuItem key={item.to} asChild className="rounded-xl p-0">
                      <Link to={item.to} className="flex flex-col items-start gap-0.5 px-3 py-2.5">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                to="/descobrir"
                search={DISCOVER_SEARCH}
                className={linkBase}
                activeProps={{ className: linkActive }}
              >
                Descobrir
              </Link>
              {VISITOR_NAV.map((item) => (
                <Link key={item.hash} to="/" hash={item.hash} className={linkBase}>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Buscar"
            className="hidden h-10 items-center gap-2 rounded-full border border-border/70 bg-card/60 pl-3.5 pr-2 text-sm text-muted-foreground transition hover:border-gold/40 hover:text-foreground md:inline-flex"
          >
            <Search className="h-4 w-4" />
            <span className="hidden xl:inline">Buscar…</span>
            <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] font-semibold">
              {isMac ? "⌘" : "Ctrl"} K
            </kbd>
          </button>
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Buscar"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>

          {isSignedIn && (
            <button
              type="button"
              onClick={() => openLumiPanel()}
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-gold lg:inline-flex"
            >
              <Sparkles className="h-4 w-4" /> Lumi
            </button>
          )}

          <ThemeSwitcher />

          {isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Conta"
                className="ml-1 rounded-full outline-none ring-2 ring-transparent transition hover:ring-gold/30 focus-visible:ring-gold/60"
              >
                <UserAvatar
                  profile={profile}
                  user={user}
                  size="md"
                  allowProviderFallback={profileReady}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
                <DropdownMenuLabel className="px-3 py-2 font-normal">
                  <p className="truncate text-sm font-semibold">
                    {profile?.displayName || user?.displayName || "Leitor"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-xl">
                  <Link to="/perfil" className="flex items-center gap-2 px-3 py-2">
                    <UserRound className="h-4 w-4" /> Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl">
                  <Link
                    to="/perfil"
                    hash="configuracoes"
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    <Settings className="h-4 w-4" /> Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void handleSignOut()}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ redirect: undefined }}
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-foreground/85 transition hover:text-gold sm:inline-flex"
              >
                Entrar
              </Link>
              <Link
                to="/auth"
                search={{ redirect: "/" }}
                className="btn-primary ml-1 whitespace-nowrap px-4 py-2.5 text-sm"
              >
                <span className="sm:hidden">Começar</span>
                <span className="hidden sm:inline">Começar grátis</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
