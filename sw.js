// Cache only versioned/static media. Documents and API responses always use the network.
const CACHE = "wt-v7-2026-08-12-home-refresh";
const PRECACHE = ["/manifest.webmanifest", "/assets/hero-wedding-planning.webp"];

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

  // Never persist documents: editorial, policy and SEO updates must be visible immediately.
  if (isNav) {
    e.respondWith(
      fetch(req).catch(() => new Response(
        "页面暂时无法访问，请检查网络连接后重试。",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      ))
    );
    return;
  }

  const cacheableAsset = /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?|mp3)$/i.test(url.pathname);
  if (!cacheableAsset) return;

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
          return new Response("offline", { status: 503 });
        })
      )
  );
});
