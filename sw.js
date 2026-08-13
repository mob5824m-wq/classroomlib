/* Service worker — enables offline use and "add to home screen" (PWA).
 *
 * Important: pages (HTML/navigation) are fetched NETWORK-FIRST so you always
 * get the latest code — a cached copy is only used as an offline fallback.
 * Static assets (js/css) use stale-while-revalidate, but they are versioned
 * with ?v=NN in the HTML, so a fresh page always pulls the current scripts.
 * Bumping CACHE below also clears any stale cached files.
 */
const CACHE = "classroomlib-v5";
const CORE = ["./", "./index.html", "./css/style.css", "./js/store.js", "./js/app.js", "./js/a11y.js", "./js/barcode.js", "./js/covers.js", "./js/home.js", "./js/admin.js", "./js/catalog.js", "./js/mylibrary.js", "./js/kiosk.js", "./js/scan.js", "./js/scanner.js", "./js/request.js", "./guide.html", "./sitemap.html", "./kiosk.html", "./my-library.html", "./admin.html", "./catalog.html", "./how-to-check-out.html"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache API calls or cross-origin (book covers, etc.).
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (e.request.method !== "GET") return;

  const isPage = e.request.mode === "navigate";

  if (isPage) {
    // Network-first for pages: always try the server, fall back to cache offline.
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then(m => m || caches.match("./index.html")))
    );
    return;
  }

  // Stale-while-revalidate for static assets (versioned via ?v=NN).
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request)
        .then(res => {
          if (res && res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
