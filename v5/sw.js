// Retires the old /v5/ test install: removes its offline cache, unregisters
// itself and sends any open window to the main address. Workout data lives in
// the site's shared storage and is not touched.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("ironlog-")).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      for (const w of windows) w.navigate(new URL("../", self.registration.scope).href);
    })()
  );
});
