// Cloudflare Worker 入口：wrangler 启用 run_worker_first，所有静态文档先在此处设置缓存策略。
import { onRequestPost as savePost } from "../functions/api/save.js";
import { onRequestGet as loadGet } from "../functions/api/load.js";
import { onRequestPost as uploadPost } from "../functions/api/upload.js";
import { onRequestGet as imgGet } from "../functions/api/img.js";
import { onRequestPost as storyPost } from "../functions/api/story.js";
import { onRequestPost as avatarPost } from "../functions/api/avatar.js";
import { onRequestPost as aiPost } from "../functions/api/ai.js";
import { onRequestPost as posterPost, onRequestGet as posterGet } from "../functions/api/poster.js";
import { onRequestGet as posterImgGet } from "../functions/api/poster-img.js";

const API = {
  "/api/save":      { POST: savePost },
  "/api/load":      { GET:  loadGet },
  "/api/upload":    { POST: uploadPost },
  "/api/img":       { GET:  imgGet },
  "/api/story":     { POST: storyPost },
  "/api/avatar":    { POST: avatarPost },
  "/api/ai":        { POST: aiPost },
  "/api/poster":    { POST: posterPost, GET: posterGet },
  "/api/poster-img":{ GET:  posterImgGet },
};

let legacyTrackingCleanupStarted = false;

async function deleteLegacyTracking(env) {
  const marker = "migration:legacy-tracking-removed-v1";
  if (await env.WEDDING.get(marker)) return;
  let cursor;
  do {
    const options = cursor ? { prefix: "track:", cursor } : { prefix: "track:" };
    const page = await env.WEDDING.list(options);
    await Promise.all(page.keys.map(({ name }) => env.WEDDING.delete(name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  await env.WEDDING.put(marker, "1");
}

function staticResponse(response, path) {
  if (response.status !== 200) return response;
  const headers = new Headers(response.headers);
  const isHtml = path === "/" || path.endsWith("/") || path.endsWith(".html");
  const mustStayFresh = isHtml || [
    "/robots.txt",
    "/sitemap.xml",
    "/rss.xml",
    "/ads.txt",
    "/sw.js",
    "/manifest.webmanifest",
  ].includes(path);

  if (isHtml) headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  if (isHtml) {
    headers.set("x-frame-options", "SAMEORIGIN");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  }
  if (mustStayFresh) {
    headers.set("cache-control", "no-store");
    headers.set("cloudflare-cdn-cache-control", "no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFoundResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("cloudflare-cdn-cache-control", "no-store");
  return new Response(response.body, { status: 404, headers });
}

function isCrossSite(request, origin) {
  const requestOrigin = request.headers.get("origin");
  return requestOrigin !== null && requestOrigin !== origin;
}

function permanentRedirect(url, pathname) {
  const target = new URL(url);
  target.pathname = pathname;
  return new Response(null, {
    status: 301,
    headers: {
      location: target.href,
      "cache-control": "public, max-age=3600",
    },
  });
}

async function canonicalHtmlRedirect(request, env, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const path = url.pathname;
  if (["/index", "/index.html", "/live", "/live.html"].includes(path)) {
    return permanentRedirect(url, "/");
  }
  if (path === "/" || path.endsWith(".html")) return null;

  const basePath = path.endsWith("/") ? path.slice(0, -1) : path;
  if (!basePath || /\.[^/]+$/.test(basePath)) return null;

  const canonicalPath = `${basePath}.html`;
  const probeUrl = new URL(canonicalPath, url.origin);
  const probe = await env.ASSETS.fetch(new Request(probeUrl.href, { method: "HEAD" }));
  return probe.status === 200 ? permanentRedirect(url, canonicalPath) : null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Remove data created by the retired first-party click tracker.
    if (!legacyTrackingCleanupStarted && env.WEDDING?.list) {
      legacyTrackingCleanupStarted = true;
      ctx.waitUntil(deleteLegacyTracking(env).catch(() => {}));
    }

    // 短链 /i/abc12345 -> /i.html?id=abc12345（在 Worker 内重写后交给静态资源）
    const m = /^\/i\/([a-z0-9]{4,16})$/i.exec(path);
    if (m) {
      const newUrl = new URL(`/i.html?id=${encodeURIComponent(m[1])}`, url.origin);
      const response = await env.ASSETS.fetch(new Request(newUrl, request));
      return staticResponse(response, "/i.html");
    }

    // /api/* 路由
    const route = API[path];
    if (route) {
      if (isCrossSite(request, url.origin)) {
        return new Response("cross-site request denied", {
          status: 403,
          headers: { "cache-control": "no-store" },
        });
      }
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      const handler = route[request.method];
      if (!handler) {
        return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      try {
        return await handler({ request, env, ctx });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    // 404 文档只能作为真实 404 响应返回，不能成为可索引的 200 页面。
    if (path === "/404" || path === "/404.html") {
      const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url.origin).href));
      return notFoundResponse(notFound);
    }

    // sitemap、canonical 与站内链接统一使用 .html；旧的无扩展名和尾斜杠地址永久归一。
    const canonicalRedirect = await canonicalHtmlRedirect(request, env, url);
    if (canonicalRedirect) return canonicalRedirect;

    // 其它路径直接交给静态资源。html_handling=none 保证 .html canonical 本身返回 200。
    const res = await env.ASSETS.fetch(request);
    // 404 fallback：HTML 请求失败时返回自定义 404 页面
    if (res.status === 404 && (request.headers.get("accept") || "").includes("text/html")) {
      const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url.origin).href));
      return notFoundResponse(notFound);
    }
    return staticResponse(res, path);
  },
};
