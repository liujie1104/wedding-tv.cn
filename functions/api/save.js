// POST /api/save  body: { invitation: {...} } -> { ok, id }
import { shortId, json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 20)) return json(429, { ok: false, error: "too many requests" });
  if (!env.WEDDING) return serverError("KV binding WEDDING not configured");

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 200_000) return badRequest("payload too large");
    payload = JSON.parse(raw);
  } catch {
    return badRequest("invalid json");
  }
  const inv = payload?.invitation;
  if (!inv || typeof inv !== "object") return badRequest("missing invitation");
  if (!inv.groom || !inv.bride) return badRequest("missing names");
  inv.createdAt = Date.now();
  inv.v = 1;

  try {
    let id = shortId(8);
    for (let i = 0; i < 3; i++) {
      const exists = await env.WEDDING.get("inv:" + id);
      if (!exists) break;
      id = shortId(8);
    }
    await env.WEDDING.put("inv:" + id, JSON.stringify(inv));
    return json(200, { ok: true, id });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
