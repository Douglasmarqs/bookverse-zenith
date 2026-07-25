/**
 * Sensitive account-management operations (change password, delete
 * account). Split out from lib/firebase.ts on purpose: these pull in
 * `reauthenticateWithCredential`/`reauthenticateWithPopup`/`updatePassword`/
 * `deleteUser`, which only the profile/settings page ever calls — keeping
 * them in a separate module lets the bundler give this its own chunk
 * instead of shipping it to every page that merely checks auth state.
 */
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword as fbUpdatePassword,
  deleteUser,
} from "firebase/auth";
import { getFirebase, getPrimaryProvider } from "./firebase";

/** Re-authenticates the current user — required by Firebase before
 * sensitive operations like changing password or deleting the account. */
async function reauthenticate(currentPassword?: string): Promise<void> {
  const fb = getFirebase();
  const user = fb?.auth.currentUser;
  if (!fb || !user) throw new Error("Você precisa estar logado.");
  const provider = getPrimaryProvider(user);
  if (provider === "google.com") {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return;
  }
  if (!user.email || !currentPassword) {
    throw new Error("Informe sua senha atual para continuar.");
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb?.auth.currentUser) throw new Error("Você precisa estar logado.");
  await reauthenticate(currentPassword);
  await fbUpdatePassword(fb.auth.currentUser, newPassword);
}

/** Deletes the user's Auth account. Firestore data cleanup happens
 * separately (see lib/user-profile.ts's deleteUserData) since Auth
 * deletion alone doesn't touch Firestore. */
export async function deleteAccount(currentPassword?: string): Promise<void> {
  const fb = getFirebase();
  if (!fb?.auth.currentUser) throw new Error("Você precisa estar logado.");
  await reauthenticate(currentPassword);
  await deleteUser(fb.auth.currentUser);
}
