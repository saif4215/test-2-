// Offline support. Pages and assets: try the network first so updates show immediately, fall back to the
// cached copy when offline. The 3D library is cached first (it never changes without a CACHE bump).
// Orders and payments (/api/*) and anything cross-origin (Square, fonts) are never touched.
const CACHE = "maruf-v1";
const SHELL = ["/", "/style.css", "/main.js", "/checkout.js", "/menu.json", "/logo.svg", "/logo-dark.svg", "/manifest.webmanifest", "/icon-192.png", "/vendor/three.module.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/vendor/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
    return;
  }
  e.respondWith(
    fetch(req).then((res) => store(req, res)).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? caches.match("/") : Response.error()))
  );
});

function store(req, res) {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
}
