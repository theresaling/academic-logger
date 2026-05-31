const CACHE_NAME = "academic-logger-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./entry-v2.html",
  "./entry-v2.js",
  "./pop.css",
  "./data-service.js",
  "./manifest.webmanifest",
  "./pwa/icon.svg",
  // Legacy v1 surfaces kept available offline for one release while we
  // confirm nothing relies on them. Safe to remove in a later cleanup.
  "./entry.html",
  "./entry.js",
  "./styles.css",
  "./subject-icons.js",
  "./dashboard.html",
  "./dashboard.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("academic-logger-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Network-first so deploys actually reach the PWA. Cache is the fallback
// when the network is unavailable.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match("./entry-v2.html");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        })
      )
  );
});
