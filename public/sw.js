// The old website installed a service worker that cached its pages. The website is gone, so this one removes
// itself and the old cache the next time a phone or browser that still has the old worker checks for updates.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll()) c.navigate(c.url);
  })());
});
