// POST /api/upload  body: { dataUrl } -> { ok, key, url }
import { shortId, json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 30)) return json(429, { ok: false, error: "too many requests" });
  if (!env.WEDDING) return serverError("KV not configured");

  let payload;
  try { payload = await request.json(); } catch { return badRequest("invalid json"); }
  const dataUrl = payload?.dataUrl;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/"))
    return badRequest("bad dataUrl");
  if (dataUrl.length > 4_500_000) return badRequest("image too large; please compress");

  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return badRequest("only jpeg/png/webp accepted");
  const mime = m[1];

  let bytes;
  try { bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)); }
  catch { return badRequest("base64 decode fail"); }
  if (bytes.length > 3_500_000) return badRequest("image too large after decode");

  try {
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const key = `${shortId(10)}.${ext}`;
    await env.WEDDING.put("img:" + key, bytes.buffer, { metadata: { mime } });
    return json(200, { ok: true, key, url: `/api/img?key=${encodeURIComponent(key)}` });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
