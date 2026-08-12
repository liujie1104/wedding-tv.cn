// POST /api/upload  body: { dataUrl } -> { ok, key, url }
import { shortId, json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const PUBLIC_IMAGE_TTL = 60 * 60 * 24 * 365;

function hasValidSignature(bytes, mime) {
  if (mime === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return sig.every((value, index) => bytes[index] === value);
  }
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

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
  if (!hasValidSignature(bytes, mime)) return badRequest("image content does not match declared type");

  try {
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const key = `${shortId(10)}.${ext}`;
    await env.WEDDING.put("img:" + key, bytes.buffer, {
      metadata: { mime },
      expirationTtl: PUBLIC_IMAGE_TTL,
    });
    return json(200, { ok: true, key, url: `/api/img?key=${encodeURIComponent(key)}` });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
