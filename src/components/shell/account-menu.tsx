import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Palette, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/firebase";
import { useMemberProfile } from "./use-member-profile";

export function AccountMenu({ side = "bottom" }: { side?: "bottom" | "right" }) {
  const { user, profile, profileReady } = useMemberProfile();
  const navigate = useNavigate();
  if (!user) return null;

  async function handleSignOut() {
    try {
      await signOut();
      void navigate({ to: "/" });
    } catch {
      toast.error("Não foi possível sair agora. Tente novamente.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Sua conta"
        className="press rounded-full outline-none ring-2 ring-transparent transition focus-visible:ring-gold/70"
      >
        <UserAvatar profile={profile} user={user} size="md" allowProviderFallback={profileReady} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align="end"
        sideOffset={10}
        className="w-64 rounded-2xl border-border bg-popover/95 p-2 backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-3 py-2 font-normal">
          <p className="truncate font-display text-xl leading-tight">
            {profile?.displayName || user.displayName || "Leitor"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/perfil" className="flex items-center gap-2 px-3 py-2">
            <UserRound className="h-4 w-4" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/ajustes" className="flex items-center gap-2 px-3 py-2">
            <Settings className="h-4 w-4" /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/ajustes" hash="aparencia" className="flex items-center gap-2 px-3 py-2">
            <Palette className="h-4 w-4" /> Aparência
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
  );
}
