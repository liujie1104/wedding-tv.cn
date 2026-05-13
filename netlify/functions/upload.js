// POST /api/upload  body: { dataUrl: "data:image/jpeg;base64,..." }
// 返回 { ok, key, url }   url 形如 /api/img?key=xxx
import { getStore } from "@netlify/blobs";
import { shortId, json, badRequest, serverError, rateLimit, getIp } from "./_lib.js";

const MAX_DATAURL_BYTES = 4_500_000; // ~3.3MB 二进制；前端会先压到 < 800KB

export default async (req) => {
  if (req.method !== "POST") return badRequest("POST only");
  if (!rateLimit(getIp(req), 30, 60_000)) return json(429, { ok: false, error: "too many requests" });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return badRequest("invalid json");
  }
  const dataUrl = payload?.dataUrl;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return badRequest("bad dataUrl");
  if (dataUrl.length > MAX_DATAURL_BYTES) return badRequest("image too large; please compress");

  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return badRequest("only jpeg/png/webp accepted");
  const mime = m[1];
  const b64 = m[2];

  let bytes;
  try {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return badRequest("base64 decode fail");
  }
  if (bytes.length > 3_500_000) return badRequest("image too large after decode");

  try {
    const store = getStore("invitation-images");
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const key = `${shortId(10)}.${ext}`;
    await store.set(key, bytes, { metadata: { mime } });
    return json(200, { ok: true, key, url: `/api/img?key=${encodeURIComponent(key)}` });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};

export const config = { path: "/api/upload" };
