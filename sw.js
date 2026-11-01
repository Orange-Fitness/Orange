// Orange service worker. Generated at build time: VERSION and PRECACHE are filled in.
// Strategy: precache the whole app shell on install, serve it cache-first so the app
// opens with no network (including after a full close), and keep the old version
// until the user taps "Update" (no surprise reloads mid-workout).

const VERSION = "8.2.0-c3c26b206a";
const CACHE = `orange-${VERSION}`;
const PRECACHE = ["./","./index.html","./manifest.webmanifest","./assets/app-3bedc9c82d.js","./assets/app-d84a15ea5e.css","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png","./icons/apple-touch-icon.png","./fonts/orange-pixel.woff"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" }))))
  );
  // No skipWaiting here: the page asks for it when the user taps Update.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Drop older versions, including caches left by the earlier "ironlog-" builds.
      await Promise.all(keys.filter((k) => (k.startsWith("orange-") || k.startsWith("ironlog-")) && k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// A schedule shared to Orange (Android share sheet): keep the file for the page, then open the app.
const SHARE_CACHE = "orange-share";
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")) {
    event.respondWith(
      (async () => {
        try {
          const form = await req.formData();
          const file = form.get("file");
          if (file && typeof file !== "string") {
            const cache = await caches.open(SHARE_CACHE);
            await cache.put("./shared-file", new Response(file, { headers: { "x-name": encodeURIComponent(file.name || "schedule.xlsx") } }));
          }
        } catch {
          /* nothing usable was shared */
        }
        return Response.redirect("./?shared=rota", 303);
      })()
    );
    return;
  }
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // GitHub API etc. go straight to the network

  if (req.mode === "navigate") {
    // Only the app's own address gets the cached app shell; other pages under this
    // scope (e.g. the retired /v5/ forwarder) load normally, falling back offline.
    const scopePath = new URL(self.registration.scope).pathname;
    if (url.pathname !== scopePath && url.pathname !== `${scopePath}index.html`) {
      event.respondWith(fetch(req).catch(() => caches.match("./index.html", { ignoreSearch: true })));
      return;
    }
    // App shell: always the cached index.html, so launching offline works.
    event.respondWith(
      caches.match("./index.html", { ignoreSearch: true }).then((hit) => hit || fetch(req))
    );
    return;
  }

  // The manifest is network-first: Chrome reads it to decide install state and icons, so it
  // must see the current one, not the copy cached with an older version.
  if (url.pathname.endsWith("/manifest.webmanifest")) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});

// Tapping the "rest over" notification brings Orange back to the front.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = all.find((c) => "focus" in c);
      if (open) return open.focus();
      return self.clients.openWindow("./");
    })()
  );
});
