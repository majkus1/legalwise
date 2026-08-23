/*
 * Service worker systemu Legal-Wise.
 *
 * ZASADA NADRZĘDNA: nie serwujemy danych kancelarii z pamięci podręcznej.
 * Prawnik musi wiedzieć, czy patrzy na aktualny stan sprawy — pokazanie
 * nieświeżych danych jako bieżących byłoby gorsze niż uczciwy komunikat
 * o braku połączenia. Buforujemy wyłącznie zasoby statyczne (ikony, manifest)
 * i stronę zastępczą wyświetlaną przy braku sieci.
 */

const CACHE_VERSION = "legal-wise-v1";
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nawigacja: zawsze z sieci. Przy jej braku pokazujemy stronę zastępczą,
  // a nie nieaktualną kopię ekranu z danymi.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((response) => response ?? Response.error())),
    );
    return;
  }

  // Zasoby statyczne: najpierw pamięć podręczna, w tle uzupełniana z sieci.
  const isStatic =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest";

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }

  // Pozostałe żądania (dane, akcje serwerowe) przepuszczamy bez udziału
  // service workera — świadomie, patrz zasada nadrzędna.
});

// ---------------------------------------------------------------------------
// Powiadomienia push
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {
    title: "Legal-Wise",
    body: "",
    url: "/",
    tag: "legal-wise",
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Powiadomienie bez poprawnego ładunku i tak warto pokazać.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      // Terminy procesowe i braki formalne nie mogą zniknąć same z ekranu.
      requireInteraction: payload.important === true,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});
