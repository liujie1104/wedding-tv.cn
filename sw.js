// Service Worker: cache static resources for offline fallback; API requests always use the network.
// v4: content-quality review release. A new cache name removes legacy AI article snapshots.
const CACHE = "wt-v5-2026-08-11-content-retirement";
const PRECACHE = ["/404.html", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API
  const isNav = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  // Navigation is network-first so reviewed content replaces old cached pages.
  if (isNav) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
            return res;
          }
          if (res && res.status === 404) {
            return fetch(new Request("/index.html", { cache: "reload" }));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            return caches.match("/index.html").then((idx) => idx || caches.match("/404.html"));
          })
        )
    );
    return;
  }

  // Network-first; use cache only when the network fails.
  e.respondWith(
    fetch(req)
      .then((res) => {
        // 仅缓存 200 OK 的 basic 响应；4xx/5xx 永不入缓存
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if ((req.headers.get("accept") || "").includes("text/html")) {
            return caches.match("/404.html");
          }
          return new Response("offline", { status: 503 });
        })
      )
  );
});
