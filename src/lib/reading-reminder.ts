const LAST_SHOWN_KEY = "bookverse:reading-reminder-last-shown";
// ~20h rather than a flat 24h so it can still fire once/day even if the
// person opens the app at a slightly different time each day.
const MIN_GAP_MS = 20 * 60 * 60 * 1000;

const MESSAGES = [
  "Um capítulo te espera. Que tal 10 minutinhos agora? 🦉",
  "Sua sequência de leitura ainda não começou hoje — bora manter viva?",
  "Psst, a Lumi separou um trecho gostoso pra você continuar de onde parou.",
  "Hoje ainda dá tempo de ler uma página que seja. Eu te ajudo a voltar. 📖",
];

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/** Must be called from a direct user gesture (a button click) — browsers
 * silently auto-deny permission requests fired on page load. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

async function show(title: string, body: string) {
  if (notificationPermission() !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "bookverse-reading-reminder",
          data: { url: "/" },
        });
        return;
      }
    }
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch (err) {
    console.warn("[reading-reminder] failed to show notification", err);
  }
}

/**
 * Shows at most one friendly nudge roughly once a day, only while the app
 * is actually open, and only for people who opted in (Notification
 * permission granted via the toggle in Perfil → Notificações).
 *
 * This is a soft in-session nudge, not a true background push — the
 * browser has no reliable way to wake a closed tab days later without a
 * server pushing to it (Firebase Cloud Messaging + a scheduled Cloud
 * Function). That's a meaningfully bigger piece of infrastructure; this
 * covers "remind me while I'm using the app on a day I haven't read yet"
 * without needing it.
 */
export function maybeShowReadingReminder(hasReadToday: boolean): void {
  if (hasReadToday) return;
  if (notificationPermission() !== "granted") return;
  const last = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0);
  if (Date.now() - last < MIN_GAP_MS) return;
  localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  void show("Lumi 🦉", msg);
}
