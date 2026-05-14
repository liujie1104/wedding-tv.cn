// Service Worker：仅缓存静态资源 + 离线 fallback；API 请求一律走网络
// v2 (2026-05-14b)：移除根路径预缓存（避免坏响应被缓存），强制清旧缓存
const CACHE = "wt-v3-2026-05-14-ba19447";
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

  // 导航请求优先取 /index.html，避免根路径偶发 404 被用户感知。
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

  // network first，仅在网络完全失败（离线）时才用缓存兜底
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
