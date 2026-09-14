import { json, readJsonBody, rateLimit, getIp, checkDailyQuota } from "../_lib.js";
import { keyHash, managedRoomPattern, normalizeSettings } from "../../src/managed-wall.js";

function randomHex(size) {
  return Array.from(crypto.getRandomValues(new Uint8Array(size)), b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequest({ request, env }) {
  if (!env.WALL_DO) return json(503, { ok: false, error: "互动服务暂不可用，请稍后重试" });
  const url = new URL(request.url);
  let body = {};
  if (request.method === "POST") {
    const parsed = await readJsonBody(request, 8192);
    if (parsed.err) return json(400, { ok: false, error: "请求格式或大小不正确" });
    body = parsed.data || {};
  }
  const action = request.method === "GET" ? (url.searchParams.get("view") === "admin" ? "admin" : "public") : body.action;
  let room = url.searchParams.get("room");
  let key;
  if (action === "create") {
    const settings = normalizeSettings(body.settings);
    if (!settings.groom || !settings.bride) return json(400, { ok: false, error: "请填写两位新人的称呼" });
    const ip = getIp(request);
    if (!rateLimit("wall-create:" + ip, 5) || !(await checkDailyQuota(env, ip, "wall-create", 10, 300))) {
      return json(429, { ok: false, error: "创建过于频繁，请稍后再试" });
    }
    room = "w_" + randomHex(12);
    key = randomHex(32);
    body = { settings, keyHash: await keyHash(key), mode: body.mode };
  } else {
    if (!managedRoomPattern.test(room || "")) return json(400, { ok: false, error: "无效房间链接，请重新扫码" });
    if (!["public", "admin", "submit", "approve", "delete", "settings", "close"].includes(action)) return json(400, { ok: false, error: "未知操作" });
    // Keep the hotel's shared IP usable; durable per-room capacity is enforced in the DO.
    if (action === "submit" && !rateLimit("wall-submit:" + getIp(request), 120)) return json(429, { ok: false, error: "发送过于频繁，请稍后重试" });
  }
  try {
    const object = env.WALL_DO.get(env.WALL_DO.idFromName(room));
    const response = await object.fetch(new Request("https://wall-room/managed/" + action, {
      method: request.method,
      headers: { "content-type": "application/json", authorization: request.headers.get("authorization") || "" },
      ...(request.method === "POST" ? { body: JSON.stringify(body) } : {}),
    }));
    const data = await response.json();
    return json(response.status, key && response.ok ? { ...data, roomId: room, adminKey: key } : data, { "x-robots-tag": "noindex, nofollow" });
  } catch {
    return json(503, { ok: false, error: "互动服务连接失败，请稍后重试" });
  }
}
