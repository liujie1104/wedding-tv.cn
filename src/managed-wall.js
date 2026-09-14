import { json } from "../functions/_lib.js";

export const MESSAGE_TTL = 24 * 60 * 60 * 1000;
export const ROOM_TTL = 7 * MESSAGE_TTL;
export const MESSAGE_LIMIT = 1000;
export const managedRoomPattern = /^w_[a-f0-9]{24}$/;
const colors = new Set(["gold", "rose", "purple", "red"]);
export const line = (value, max) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
export async function keyHash(key) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function normalizeSettings(input = {}) {
  if (!input || typeof input !== "object") input = {};
  return {
    groom: line(input.groom, 20), bride: line(input.bride, 20),
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : "",
    venue: line(input.venue, 60),
    theme: ["rose", "forest", "ink"].includes(input.theme) ? input.theme : "rose",
  };
}
function publicRoom(meta) {
  return { ...meta.settings, expiresAt: meta.expiresAt, accepting: meta.accepting, paused: meta.paused, mode: meta.mode };
}
function error(status, message) { return json(status, { ok: false, error: message }); }

// Every read/modify/write runs in one storage transaction, including concurrent moderation.
export async function managedFetch(state, request) {
  const url = new URL(request.url);
  const action = url.pathname.split("/").pop();
  let body = {};
  if (request.method === "POST") {
    try { body = await request.json(); } catch { return error(400, "无效请求"); }
  }
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  const hash = token ? await keyHash(token) : "";
  return state.storage.transaction(async store => {
    const now = Date.now();
    let meta = await store.get("managed");
    if (action === "create" && request.method === "POST") {
      if (meta) return error(409, "房间已存在");
      meta = {
        settings: normalizeSettings(body.settings), keyHash: body.keyHash,
        createdAt: now, expiresAt: now + ROOM_TTL, accepting: true, paused: false,
        mode: body.mode === "event" ? "event" : "trial",
        submitted: 0, approved: 0, firstMessageAt: null,
      };
      await store.put("managed", meta);
      await store.setAlarm(meta.expiresAt);
      return json(201, { ok: true, room: publicRoom(meta) });
    }
    if (!meta || now >= meta.expiresAt) return error(410, "房间不存在或已过期，请创建新房间");
    const admin = hash !== "" && hash === meta.keyHash;
    if (action !== "public" && action !== "submit" && !admin) return error(403, "需要主持人管理权限");
    if (action === "public" || action === "admin") {
      if (request.method !== "GET") return error(405, "请求方式不支持");
      const entries = await store.list({ prefix: "entry:" });
      const messages = [...entries.values()].filter(m => m.ts > now - MESSAGE_TTL && (admin || m.status === "approved"));
      messages.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
      return json(200, {
        ok: true, room: publicRoom(meta), messages, total: messages.length,
        ...(admin ? { stats: { submitted: meta.submitted, approved: meta.approved, firstMessageAt: meta.firstMessageAt, createdAt: meta.createdAt, remaining: MESSAGE_LIMIT - meta.submitted } } : {}),
      });
    }
    if (request.method !== "POST") return error(405, "请求方式不支持");
    if (action === "submit") {
      const id = line(body.id, 36);
      const name = line(body.name, 16), message = line(body.message, 120);
      if (!/^[a-f0-9-]{36}$/.test(id) || !name || !message) return error(400, "请填写昵称和祝福");
      // The client reuses this ID after a timeout so a retry never creates a duplicate.
      if (await store.get("receipt:" + id)) return json(200, { ok: true, pending: true });
      if (!meta.accepting) return error(409, "主持人已暂停接收祝福");
      if (meta.submitted >= MESSAGE_LIMIT) return error(409, "本房间已达到 1000 条上限，请联系主持人");
      const item = { id, name, message, identity: line(body.identity, 24), color: colors.has(body.color) ? body.color : "rose", ts: now, status: "pending" };
      await store.put("entry:" + id, item);
      await store.put("receipt:" + id, true);
      meta.submitted++;
      meta.firstMessageAt ||= now;
      await store.put("managed", meta);
      const alarm = await store.getAlarm();
      await store.setAlarm(Math.min(alarm || meta.expiresAt, now + MESSAGE_TTL));
      return json(200, { ok: true, pending: true });
    }
    if (action === "approve" || action === "delete") {
      const id = line(body.id, 36);
      const item = await store.get("entry:" + id);
      if (!item || item.ts <= now - MESSAGE_TTL) return error(404, "祝福已删除或过期");
      if (action === "delete") await store.delete("entry:" + id);
      else if (item.status !== "approved") {
        item.status = "approved";
        await store.put("entry:" + id, item);
        meta.approved++;
        await store.put("managed", meta);
      }
      return json(200, { ok: true });
    }
    if (action === "settings") {
      if (body.settings) {
        const settings = normalizeSettings(body.settings);
        if (!settings.groom || !settings.bride) return error(400, "请填写两位新人的称呼");
        meta.settings = settings;
      }
      if (typeof body.accepting === "boolean") meta.accepting = body.accepting;
      if (typeof body.paused === "boolean") meta.paused = body.paused;
      await store.put("managed", meta);
      return json(200, { ok: true, room: publicRoom(meta) });
    }
    if (action === "close") {
      const keys = await store.list();
      const names = [...keys.keys()];
      for (let i = 0; i < names.length; i += 128) await store.delete(names.slice(i, i + 128));
      await store.deleteAlarm();
      return json(200, { ok: true });
    }
    return error(400, "未知操作");
  });
}

export async function managedAlarm(state) {
  const meta = await state.storage.get("managed");
  if (!meta) return false;
  if (Date.now() >= meta.expiresAt) {
    await state.storage.deleteAll();
    return true;
  }
  await state.storage.transaction(async store => {
    const now = Date.now();
    let next = meta.expiresAt;
    const entries = await store.list({ prefix: "entry:" });
    for (const [key, item] of entries) {
      if (item.ts + MESSAGE_TTL <= now) await store.delete(key);
      else next = Math.min(next, item.ts + MESSAGE_TTL);
    }
    await store.setAlarm(next);
  });
  return true;
}
