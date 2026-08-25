// Cloudflare Pages Function: /api/wall
// 婚礼现场大屏互动与弹幕 API
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const WALL_TTL = 60 * 60 * 24; // 24小时有效期

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

// GET /api/wall?room=xxx&since=timestamp
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const room = cleanText(url.searchParams.get("room"), 32) || "demo";
  const since = Number(url.searchParams.get("since") || 0);

  if (!env.WEDDING) {
    // 降级模式（无 KV 绑定时返回空列表或演示数据）
    return json(200, { ok: true, messages: [], total: 0, mode: "local" });
  }

  try {
    const raw = await env.WEDDING.get(`wall:${room}`);
    const list = raw ? JSON.parse(raw) : [];
    const newItems = list.filter((item) => item.ts > since);
    return json(200, { ok: true, messages: newItems, total: list.length });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};

// POST /api/wall
// body: { room, name, identity, message, color }
export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 30)) {
    return json(429, { ok: false, error: "发送过于频繁，请稍候再试" });
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 10_000) return badRequest("payload too large");
    payload = JSON.parse(raw);
  } catch {
    return badRequest("invalid json");
  }

  const room = cleanText(payload?.room, 32) || "demo";
  const name = cleanText(payload?.name, 16) || "热心宾客";
  const identity = cleanText(payload?.identity, 24) || "现场宾客";
  const message = cleanText(payload?.message, 120);
  const color = cleanText(payload?.color, 12) || "gold";

  if (!message) return badRequest("请填写祝福语");

  const newItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    identity,
    message,
    color,
    ts: Date.now(),
  };

  if (!env.WEDDING) {
    return json(200, { ok: true, item: newItem, mode: "local" });
  }

  try {
    const raw = await env.WEDDING.get(`wall:${room}`);
    let list = raw ? JSON.parse(raw) : [];
    // 限制单房间最多保留最近 200 条
    list.push(newItem);
    if (list.length > 200) list = list.slice(-200);

    await env.WEDDING.put(`wall:${room}`, JSON.stringify(list), { expirationTtl: WALL_TTL });
    return json(200, { ok: true, item: newItem });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
