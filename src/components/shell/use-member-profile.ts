import { useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { ensureUserProfile, subscribeUserProfile, type UserProfile } from "@/lib/user-profile";

/** Signed-in user + live profile, shared by the shell pieces. */
export function useMemberProfile() {
  const user = useAuthUser();
  const signedIn = !!user && !user.isAnonymous;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!signedIn || !user) {
      setProfile(null);
      setProfileReady(false);
      return;
    }
    void ensureUserProfile(user);
    setProfileReady(false);
    return subscribeUserProfile(user.uid, (p) => {
      setProfile(p);
      setProfileReady(true);
    });
  }, [signedIn, user]);

  return { user: signedIn ? user : null, signedIn, profile, profileReady };
}
