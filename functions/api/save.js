// POST /api/save  body: { invitation: {...} } OR { wall: {...} } -> { ok, id/item }
import { shortId, json, badRequest, serverError, rateLimit, getIp, readJsonBody, checkDailyQuota } from "../_lib.js";

const PUBLIC_INVITATION_TTL = 60 * 60 * 24 * 365;
const TEMPLATES = new Set(["gold", "cream", "morandi", "hk"]);
const MUSIC = new Set(["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
const AVATAR_STYLES = new Set(["line", "cartoon", "oil", "hk"]);

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function cleanLine(value, max) {
  return cleanText(value, max).replace(/\s+/g, " ");
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function imageRef(value) {
  const key = cleanLine(value?.key, 24);
  if (!/^[a-z0-9]{4,16}\.(?:jpg|png|webp)$/i.test(key)) return null;
  return { key, url: `/api/img?key=${encodeURIComponent(key)}` };
}

function normalizeInvitation(value) {
  const date = cleanLine(value?.date, 10);
  const time = cleanLine(value?.time, 5);
  const template = cleanLine(value?.template, 16);
  const music = cleanLine(value?.music, 2);
  const invitation = {
    template: TEMPLATES.has(template) ? template : "gold",
    groom: cleanLine(value?.groom, 20),
    bride: cleanLine(value?.bride, 20),
    date: isValidDate(date) ? date : "",
    time: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "11:58",
    city: cleanLine(value?.city, 20),
    venue: cleanLine(value?.venue, 60),
    greeting: cleanText(value?.greeting, 120),
    story: cleanText(value?.story, 2000),
    music: MUSIC.has(music) ? music : "",
    cover: imageRef(value?.cover),
    avatars: [],
    createdAt: Date.now(),
    v: 2,
  };

  if (Array.isArray(value?.avatars)) {
    invitation.avatars = value.avatars.slice(0, 3).flatMap((avatar) => {
      const image = imageRef(avatar);
      if (!image) return [];
      const style = cleanLine(avatar?.style, 12);
      return [{ ...image, style: AVATAR_STYLES.has(style) ? style : "line" }];
    });
  }
  return invitation;
}

export const onRequestPost = async ({ request, env }) => {
  const ip = getIp(request);
  if (!rateLimit(ip, 30)) return json(429, { ok: false, error: "too many requests" });
  if (!env.WEDDING) return serverError("KV binding WEDDING not configured");

  const { data: payload, err } = await readJsonBody(request, 200_000);
  if (err === "payload_too_large") return json(413, { ok: false, error: "payload too large" });
  if (err) return badRequest("invalid json");

  // 1. 婚礼大屏弹幕支持
  if (payload?.wall) {
    const room = cleanLine(payload.wall.room, 32) || "wedding888";
    const name = cleanLine(payload.wall.name, 16) || "热心宾客";
    const identity = cleanLine(payload.wall.identity, 24) || "现场宾客";
    const message = cleanText(payload.wall.message, 120);
    const color = cleanLine(payload.wall.color, 12) || "gold";
    if (!message) return badRequest("missing message");

    const allowed = await checkDailyQuota(env, ip, "wall", 50, 5000);
    if (!allowed) return json(429, { ok: false, error: "今日弹幕发送过多，请明日再试" });

    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      identity,
      message,
      color,
      ts: Date.now(),
    };

    // 1. 如果配置了 Durable Object (env.WALL_DO)，按房间隔离并串行写入，避免并发覆写
    if (env?.WALL_DO) {
      try {
        const id = env.WALL_DO.idFromName(room);
        const obj = env.WALL_DO.get(id);
        const doRes = await obj.fetch("https://wall-room/message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(newItem),
        });
        const doData = await doRes.json();
        return json(200, doData);
      } catch (e) {
        return serverError(String(e?.message || e));
      }
    }

    // 2. KV 兜底模式（未配置 WALL_DO 时）
    try {
      const raw = await env.WEDDING.get("wall:" + room);
      let list = raw ? JSON.parse(raw) : [];
      list.push(newItem);
      if (list.length > 200) list = list.slice(-200);
      await env.WEDDING.put("wall:" + room, JSON.stringify(list), { expirationTtl: 86400 });
      return json(200, { ok: true, item: newItem });
    } catch (e) {
      return serverError(String(e?.message || e));
    }
  }

  // 2. 电子请帖保存
  if (!payload?.invitation || typeof payload.invitation !== "object") return badRequest("missing invitation");
  const inv = normalizeInvitation(payload.invitation);
  if (!inv.groom || !inv.bride) return badRequest("missing names");
  if (!inv.date) return badRequest("invalid date");

  const invAllowed = await checkDailyQuota(env, ip, "invite", 10, 500);
  if (!invAllowed) return json(429, { ok: false, error: "今日请帖创建次数过多，请明日再试" });

  try {
    let id = shortId(8);
    for (let i = 0; i < 3; i++) {
      const exists = await env.WEDDING.get("inv:" + id);
      if (!exists) break;
      id = shortId(8);
    }
    await env.WEDDING.put("inv:" + id, JSON.stringify(inv), { expirationTtl: PUBLIC_INVITATION_TTL });
    return json(200, { ok: true, id });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
