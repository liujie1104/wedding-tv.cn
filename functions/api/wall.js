// Cloudflare Pages Function: /api/wall
// 婚礼现场大屏互动与弹幕 API（严格导出 onRequestGet / onRequestPost / onRequestOptions）
import { rateLimit, getIp } from "../_lib.js";

const WALL_TTL = 60 * 60 * 24; // 24小时有效期

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

// 内存级本地消息池兜底
const localRoomStore = new Map();

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet = async ({ request, env }) => {
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
  } else {
    list = localRoomStore.get(room) || [];
  }

  const newItems = list.filter((item) => item.ts > since);
  return new Response(JSON.stringify({ ok: true, messages: newItems, total: list.length }), {
    status: 200,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 30)) {
    return new Response(JSON.stringify({ ok: false, error: "发送过于频繁，请稍候再试" }), {
      status: 429,
      headers: CORS_HEADERS,
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "无效的请求格式" }), {
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
  } else {
    let list = localRoomStore.get(room) || [];
    list.push(newItem);
    if (list.length > 200) list = list.slice(-200);
    localRoomStore.set(room, list);
  }

  return new Response(JSON.stringify({ ok: true, item: newItem }), {
    status: 200,
    headers: CORS_HEADERS,
  });
};
