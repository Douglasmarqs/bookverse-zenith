import type { User } from "firebase/auth";

type MinimalProfile = {
  avatarEmoji?: string | null;
  customPhotoDataUrl?: string | null;
  photoURL?: string | null;
  displayName?: string | null;
};

const SIZES = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-20 w-20 text-3xl",
} as const;

/**
 * Renders, in priority order: the chosen emoji avatar, a photo the person
 * uploaded themselves, the account's provider photo (e.g. Google), or a
 * colored initial. Used anywhere a user's avatar shows up so all four stay
 * visually consistent. Accepts any object with the display fields — the
 * full `UserProfile`, a `RankingRow`, or anything else shaped the same way.
 */
export function UserAvatar({
  profile,
  user,
  size = "md",
  className = "",
}: {
  profile?: MinimalProfile | null;
  user?: User | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const emoji = profile?.avatarEmoji;
  const photo = profile?.customPhotoDataUrl || profile?.photoURL || user?.photoURL;
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
