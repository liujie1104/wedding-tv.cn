// Cloudflare Pages Function: /api/wall
// 婚礼现场大屏互动 API
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const WALL_TTL = 60 * 60 * 24;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

// GET & POST in single onRequest handler
export const onRequest = async ({ request, env }) => {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 1. GET 轮询拉取
  if (method === "GET") {
    const url = new URL(request.url);
    const room = cleanText(url.searchParams.get("room"), 32) || "wedding888";
    const since = Number(url.searchParams.get("since") || 0);

    let list = [];
    if (env && env.WEDDING) {
      try {
        const raw = await env.WEDDING.get(`wall:${room}`);
        if (raw) list = JSON.parse(raw);
      } catch (e) {
        console.error("KV read error:", e);
      }
    }
    const newItems = list.filter((item) => item.ts > since);
    return new Response(JSON.stringify({ ok: true, messages: newItems, total: list.length }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  // 2. POST 宾客发送祝福
  if (method === "POST") {
    if (!rateLimit(getIp(request), 30)) {
      return new Response(JSON.stringify({ ok: false, error: "发送过于频繁，请稍候" }), {
        status: 429,
        headers: CORS_HEADERS,
      });
    }

    let payload;
    try {
      const raw = await request.text();
      payload = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "请求格式错误" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const room = cleanText(payload?.room, 32) || "wedding888";
    const name = cleanText(payload?.name, 16) || "热心宾客";
    const identity = cleanText(payload?.identity, 24) || "现场宾客";
    const message = cleanText(payload?.message, 120);
    const color = cleanText(payload?.color, 12) || "gold";

    if (!message) {
      return new Response(JSON.stringify({ ok: false, error: "请填写祝福语" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      identity,
      message,
      color,
      ts: Date.now(),
    };

    if (env && env.WEDDING) {
      try {
        const raw = await env.WEDDING.get(`wall:${room}`);
        let list = raw ? JSON.parse(raw) : [];
        list.push(newItem);
        if (list.length > 200) list = list.slice(-200);
        await env.WEDDING.put(`wall:${room}`, JSON.stringify(list), { expirationTtl: WALL_TTL });
      } catch (e) {
        console.error("KV write error:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, item: newItem }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
    status: 405,
    headers: CORS_HEADERS,
  });
};
