// BookVerse service worker — minimal and hand-written (no bundler plugin
// like Workbox). Two jobs:
//   1. Makes the app installable ("Add to Home Screen" / desktop install)
//      on browsers that require an active service worker for that.
//   2. Runtime-caches same-origin requests so pages you've already opened
//      still load if you lose connection, and shows the reading-reminder
//      notifications (see src/lib/reading-reminder.ts).
//
// It deliberately does NOT try to precache the app's hashed JS/CSS
// bundles — those filenames change on every deploy, and reliably
// precaching them without a build-time tool (Workbox's Vite/webpack
// plugins) is fragile. Offline support here is "best effort for pages
// you've already visited," not full offline-first.

const CACHE_NAME = "bookverse-v1";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never intercept cross-origin calls (Firebase, Google Books, Open
  // Library, Gutenberg, etc.) — those already have their own retry/
  // fallback logic in the app, doubling up here would only confuse it.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return res;
          })
          .catch(() => cached),
    ),
  );
});

// Reading-reminder notifications are shown via this SW's registration
// (see src/lib/reading-reminder.ts) so they work even in a background
// tab. Clicking one focuses an existing tab or opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(event.notification.data?.url || "/");
    }),
  );
});
