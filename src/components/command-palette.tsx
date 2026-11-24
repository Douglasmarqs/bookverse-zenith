import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  Home,
  Library,
  Moon,
  NotebookPen,
  Search,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Medal,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useSiteTheme } from "@/hooks/use-site-theme";
import { onOpenCommandPalette } from "@/lib/command-palette-store";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { THEME_LABEL, allThemes } from "@/lib/theme";

/**
 * Global ⌘K / Ctrl+K palette: jump anywhere, open a book from the shelf,
 * search the catalogue, ask Lumi or switch theme — all from the keyboard.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const navigate = useNavigate();
  const user = useAuthUser();
  const signedIn = !!user && !user.isAnonymous;
  const [, setTheme] = useSiteTheme();

  useEffect(() => onOpenCommandPalette(() => setOpen(true)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Only listen to the library while the palette is open.
  useEffect(() => {
    if (!open || !signedIn || !user) return;
    return subscribeLibrary(user.uid, setLibrary);
  }, [open, signedIn, user]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function run(fn: () => void) {
    setOpen(false);
    // Let the dialog close before navigating so focus returns cleanly.
    requestAnimationFrame(fn);
  }

  const q = query.trim();
  const pages = [
    { label: "Início", icon: <Home />, to: "/" as const },
    { label: "Descobrir livros", icon: <Compass />, to: "/descobrir" as const },
    ...(signedIn
      ? [
          { label: "Minha biblioteca", icon: <Library />, to: "/biblioteca" as const },
          { label: "Diário de leitura", icon: <NotebookPen />, to: "/diario" as const },
          { label: "Metas", icon: <Target />, to: "/metas" as const },
          { label: "Desafios", icon: <Medal />, to: "/desafios" as const },
          { label: "Meu perfil", icon: <UserRound />, to: "/perfil" as const },
        ]
      : []),
    { label: "Ranking", icon: <Trophy />, to: "/ranking" as const },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar livros, páginas ou ações…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[min(60vh,420px)]">
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {q && (
          <CommandGroup heading="Catálogo">
            <CommandItem
              value={`buscar ${q}`}
              onSelect={() =>
                run(() => navigate({ to: "/descobrir", search: { q, categoria: undefined } }))
              }
            >
              <Search /> Buscar “{q}” no Descobrir
            </CommandItem>
          </CommandGroup>
        )}
        {signedIn && library.some((e) => e.readerId) && (
          <CommandGroup heading="Na sua estante">
            {library
              .filter((e) => e.readerId)
              .slice(0, 30)
              .map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.title} ${e.author ?? ""}`}
                  onSelect={() =>
                    run(() => navigate({ to: "/reader/$bookId", params: { bookId: e.readerId! } }))
                  }
                >
                  <BookOpen />
                  <span className="truncate">{e.title}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{e.author}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Ir para">
          {pages.map((p) => (
            <CommandItem
              key={p.to}
              value={p.label}
              onSelect={() =>
                run(() =>
                  navigate({
                    to: p.to,
                    search: (p.to === "/descobrir"
                      ? { q: undefined, categoria: undefined }
                      : undefined) as never,
                  }),
                )
              }
            >
              {p.icon} {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações">
          <CommandItem value="perguntar lumi ia" onSelect={() => run(() => openLumiPanel())}>
            <Sparkles /> Perguntar à Lumi
          </CommandItem>
          {allThemes().map((t) => (
            <CommandItem
              key={t}
              value={`tema ${THEME_LABEL[t]}`}
              onSelect={() => run(() => setTheme(t))}
            >
              <Moon /> Tema {THEME_LABEL[t].toLowerCase()}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
