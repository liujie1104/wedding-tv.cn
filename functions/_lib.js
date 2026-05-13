// Cloudflare Pages Functions 共用工具
export function shortId(len = 8) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += alphabet[arr[i] % alphabet.length];
  return s;
}

export function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      ...extra,
    },
  });
}

export const badRequest = (m) => json(400, { ok: false, error: m });
export const serverError = (m) => json(500, { ok: false, error: m });

// 内存级 IP 限流（每个 isolate 独立）
const buckets = new Map();
export function rateLimit(ip, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const arr = (buckets.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  buckets.set(ip, arr);
  return true;
}

export function getIp(req) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
