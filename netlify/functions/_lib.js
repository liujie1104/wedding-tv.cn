// 通用工具：生成短 ID、JSON 响应、CORS
export function shortId(len = 8) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // 去掉易混淆字符
  let s = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) s += alphabet[arr[i] % alphabet.length];
  return s;
}

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      ...extraHeaders,
    },
  });
}

export function badRequest(msg) {
  return json(400, { ok: false, error: msg });
}

export function serverError(msg) {
  return json(500, { ok: false, error: msg });
}

// 简易内存级速率限制（每个 cold-start 实例独立；够防误触/恶意刷）
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
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
