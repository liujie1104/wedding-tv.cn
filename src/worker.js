// Cloudflare Worker 入口：路由 /api/* 到对应处理函数；其它请求交给静态资源
import { onRequestPost as savePost } from "../functions/api/save.js";
import { onRequestGet as loadGet } from "../functions/api/load.js";
import { onRequestPost as uploadPost } from "../functions/api/upload.js";
import { onRequestGet as imgGet } from "../functions/api/img.js";
import { onRequestPost as storyPost } from "../functions/api/story.js";
import { onRequestPost as avatarPost } from "../functions/api/avatar.js";
import { onRequestPost as aiPost } from "../functions/api/ai.js";
import { onRequestGet as debugGet } from "../functions/api/debug-env.js";

const API = {
  "/api/save":      { POST: savePost },
  "/api/load":      { GET:  loadGet },
  "/api/upload":    { POST: uploadPost },
  "/api/img":       { GET:  imgGet },
  "/api/story":     { POST: storyPost },
  "/api/avatar":    { POST: avatarPost },
  "/api/ai":        { POST: aiPost },
  "/api/debug-env": { GET:  debugGet },
};

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 短链 /i/abc12345 -> /i.html?id=abc12345（在 Worker 内重写后交给静态资源）
    const m = /^\/i\/([a-z0-9]{4,16})$/i.exec(path);
    if (m) {
      const newUrl = new URL(`/i.html?id=${encodeURIComponent(m[1])}`, url.origin);
      return env.ASSETS.fetch(new Request(newUrl, request));
    }

    // /api/* 路由
    const route = API[path];
    if (route) {
      if (request.method === "OPTIONS") return corsPreflight();
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

    // 其它路径 -> 静态资源
    return env.ASSETS.fetch(request);
  },
};
