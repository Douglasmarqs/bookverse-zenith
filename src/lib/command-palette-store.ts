/** Opens the global ⌘K palette from anywhere (header, tab bar, shortcuts). */
const EVENT = "bookverse:open-command-palette";

export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onOpenCommandPalette(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
