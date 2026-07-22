import type { User } from "firebase/auth";
import type { UserProfile } from "@/lib/user-profile";

const SIZES = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-20 w-20 text-3xl",
} as const;

/**
 * Renders, in priority order: the chosen emoji avatar, the account's photo
 * (Google profile picture), or a colored initial. Used anywhere a user's
 * avatar shows up so all three stay visually consistent.
 */
export function UserAvatar({
  profile,
  user,
  size = "md",
  className = "",
}: {
  profile?: UserProfile | null;
  user?: User | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const emoji = profile?.avatarEmoji;
  const photo = profile?.photoURL ?? user?.photoURL;
  const name = (profile?.displayName || user?.displayName || user?.email || "Leitor").trim();
  const base = `grid shrink-0 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/40 ${SIZES[size]} ${className}`;

  if (emoji) {
    return (
      <span className={base} aria-hidden>
        {emoji}
      </span>
    );
  }
  if (photo) {
    return (
      <span className={base}>
        <img src={photo} alt="" className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }
  return (
    <span className={`${base} font-semibold text-gold`} aria-hidden>
      {name.charAt(0).toUpperCase() || "?"}
    </span>
  );
}
