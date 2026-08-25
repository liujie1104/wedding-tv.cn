// POST /api/wall-send
// 宾客微信发送弹幕接口
import { rateLimit, getIp } from "../_lib.js";

const WALL_TTL = 60 * 60 * 24;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
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

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost = async ({ request, env }) => {
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
};
