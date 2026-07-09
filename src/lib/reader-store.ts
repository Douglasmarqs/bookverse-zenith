/**
 * Reader store — settings + progress persistence.
 *
 * Local-first via localStorage, with an async interface so a cloud sync
 * (Firebase / Lovable Cloud) can plug in without touching the UI. To wire
 * a remote backend later, replace `readRemote` / `writeRemote` and keep the
 * shape identical.
 */

export type ReaderTheme = "light" | "sepia" | "dark";
export type ReaderFont = "serif" | "sans";
export type ReaderMode = "scroll" | "paginated";

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number; // px (14–28)
  lineHeight: number; // 1.3–2.2
  margin: number; // px horizontal padding (16–96)
  maxWidth: number; // ch (40–90)
  mode: ReaderMode;
}

export interface ReadingProgress {
  chapterIndex: number;
  scrollRatio: number; // 0..1 within chapter
  updatedAt: number;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "dark",
  font: "serif",
  fontSize: 18,
  lineHeight: 1.7,
  margin: 32,
  maxWidth: 66,
  mode: "scroll",
};

const SETTINGS_KEY = "bookverse:reader:settings";
const progressKey = (bookId: string) => `bookverse:reader:progress:${bookId}`;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

export function loadSettings(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  return safeParse(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS);
}

export function saveSettings(s: ReaderSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadProgress(bookId: string): ReadingProgress | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(progressKey(bookId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReadingProgress;
  } catch {
    return null;
  }
}

export function saveProgress(bookId: string, p: ReadingProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(progressKey(bookId), JSON.stringify(p));
  // Fire-and-forget remote sync when cloud is wired.
  void writeRemote(bookId, p);
}

/* ---------- Remote sync stubs (Firebase to be wired next) ---------- */

async function writeRemote(_bookId: string, _p: ReadingProgress): Promise<void> {
  // TODO: send to Firestore doc `users/{uid}/progress/{bookId}` once auth is wired.
}
