// Cloudflare Worker API 共用工具
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

// 持久化 KV 每日额度控制 (单 IP 日额度 + 全站每日预算)
export async function checkDailyQuota(env, ip, scope = "ai", maxPerIp = 30, maxGlobal = 1000) {
  if (!env || !env.WEDDING_KV) return true; // 若无 KV 则使用内存限流
  try {
    const today = new Date().toISOString().slice(0, 10);
    const ipKey = `quota:${scope}:ip:${today}:${ip}`;
    const globalKey = `quota:${scope}:global:${today}`;

    const [ipCountStr, globalCountStr] = await Promise.all([
      env.WEDDING_KV.get(ipKey),
      env.WEDDING_KV.get(globalKey),
    ]);

    const ipCount = parseInt(ipCountStr || "0", 10);
    const globalCount = parseInt(globalCountStr || "0", 10);

    if (ipCount >= maxPerIp || globalCount >= maxGlobal) {
      return false;
    }

    // 递增计数并保留 48 小时 TTL
    await Promise.all([
      env.WEDDING_KV.put(ipKey, String(ipCount + 1), { expirationTtl: 172800 }),
      env.WEDDING_KV.put(globalKey, String(globalCount + 1), { expirationTtl: 172800 }),
    ]);
    return true;
  } catch (e) {
    console.error("checkDailyQuota error", e);
    return true; // 故障时不中断服务，降级放行
  }
}

// 请求体安全解析与大小限制
export async function readJsonBody(request, maxBytes = 16384) {
  const cl = request.headers.get("content-length");
  if (cl && parseInt(cl, 10) > maxBytes) {
    return { err: "payload_too_large" };
  }
  try {
    const text = await request.text();
    if (text.length > maxBytes) return { err: "payload_too_large" };
    return { data: JSON.parse(text) };
  } catch {
    return { err: "invalid_json" };
  }
}

export function getIp(req) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
