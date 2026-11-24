/**
 * First-run preferences gathered by /bem-vindo. Stored privately at
 * users/{uid}/preferences/onboarding (owner-only in firestore.rules) and
 * mirrored in localStorage so the app knows instantly, even offline.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebase } from "./firebase";
import { withDeadline, withFallback } from "./async-utils";

export type ReadingMoment = "manha" | "tarde" | "noite" | "qualquer";

export interface OnboardingPrefs {
  genres: string[];
  dailyMinutes: number;
  moment: ReadingMoment;
  completedAt: number;
}

export const GENRES = [
  { id: "classicos-br", label: "Clássicos brasileiros", color: "#3c5a4a" },
  { id: "romance", label: "Romance", color: "#7a2e30" },
  { id: "misterio", label: "Mistério", color: "#22344a" },
  { id: "gotico", label: "Terror gótico", color: "#1d1d1b", fg: "#d9a54e" },
  { id: "fantasia", label: "Fantasia", color: "#4b3a5c" },
  { id: "poesia", label: "Poesia", color: "#c49a52", fg: "#2a1f14" },
  { id: "filosofia", label: "Filosofia", color: "#5b6b3a" },
  { id: "aventura", label: "Aventura", color: "#8a3d24" },
  { id: "ficcao-cientifica", label: "Ficção científica", color: "#2c4b5a" },
  { id: "historia", label: "História", color: "#6b4a2a" },
  { id: "contos", label: "Contos", color: "#7a5a6a" },
  { id: "absurdo", label: "Absurdo", color: "#c9b83a", fg: "#1d1b16" },
] as const;

/** Which genres each Lumi pick (by Gutenberg id) speaks to. */
export const PICK_GENRES: Record<number, string[]> = {
  55752: ["classicos-br", "romance"],
  84: ["gotico", "ficcao-cientifica", "filosofia"],
  1661: ["misterio", "contos"],
  5200: ["absurdo", "filosofia", "contos"],
  1342: ["romance"],
  345: ["gotico", "misterio"],
  11: ["fantasia", "absurdo"],
  2701: ["aventura", "filosofia"],
};

const localKey = (uid: string) => `bookverse:onboarding:${uid}`;

export function getLocalOnboarding(uid: string): OnboardingPrefs | null {
  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? (JSON.parse(raw) as OnboardingPrefs) : null;
  } catch {
    return null;
  }
}

export async function loadOnboarding(uid: string): Promise<OnboardingPrefs | null> {
  const local = getLocalOnboarding(uid);
  if (local) return local;
  const fb = getFirebase();
  if (!fb) return null;
  const snap = await withFallback(
    getDoc(doc(fb.db, "users", uid, "preferences", "onboarding")),
    5000,
    null,
  ).catch(() => null);
  if (!snap?.exists()) return null;
  const prefs = snap.data() as OnboardingPrefs;
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(prefs));
  } catch {
    // storage unavailable
  }
  return prefs;
}

export async function saveOnboarding(uid: string, prefs: OnboardingPrefs): Promise<void> {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(prefs));
  } catch {
    // storage unavailable — Firestore below is still the source of truth
  }
  const fb = getFirebase();
  if (!fb) return;
  await withDeadline(
    setDoc(doc(fb.db, "users", uid, "preferences", "onboarding"), prefs, { merge: true }),
    10000,
    "Não foi possível salvar suas preferências agora.",
  );
}
