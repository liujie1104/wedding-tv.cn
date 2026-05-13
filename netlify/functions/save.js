// POST /api/save  body: { invitation: {...} }
// 返回 { ok, id }
import { getStore } from "@netlify/blobs";
import { shortId, json, badRequest, serverError, rateLimit, getIp } from "./_lib.js";

const MAX_BODY_BYTES = 200_000; // 200KB（图片走 /api/upload 单独存 key，不直接进 invitation JSON）

export default async (req) => {
  if (req.method !== "POST") return badRequest("POST only");
  if (!rateLimit(getIp(req), 20, 60_000)) return json(429, { ok: false, error: "too many requests" });

  let payload;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return badRequest("payload too large");
    payload = JSON.parse(raw);
  } catch {
    return badRequest("invalid json");
  }
  const inv = payload?.invitation;
  if (!inv || typeof inv !== "object") return badRequest("missing invitation");

  // 服务端最小校验：必填字段
  if (!inv.groom || !inv.bride) return badRequest("missing names");
  inv.createdAt = Date.now();
  inv.v = 1;

  try {
    const store = getStore("invitations");
    // 找一个未被占用的短 id（碰撞概率极低，最多重试 3 次）
    let id = shortId(8);
    for (let i = 0; i < 3; i++) {
      const exists = await store.get(id);
      if (!exists) break;
      id = shortId(8);
    }
    await store.setJSON(id, inv);
    return json(200, { ok: true, id });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};

export const config = { path: "/api/save" };
