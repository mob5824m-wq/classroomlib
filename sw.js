/* Service worker — enables offline use and "add to home screen" (PWA). */
const CACHE = "classroomlib-v1";
const CORE = ["./", "./index.html", "./css/style.css", "./js/store.js", "./js/app.js", "./js/a11y.js", "./js/barcode.js", "./js/covers.js", "./js/home.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Don't cache API calls or cross-origin (covers).
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res && res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
