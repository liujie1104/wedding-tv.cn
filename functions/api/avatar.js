// POST /api/avatar  body: { style } -> { ok, dataUrl, provider, style }
// 文生图：Pollinations 优先（免费无 key），失败降级到 Cloudflare Workers AI
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const STYLE_PROMPT = {
  cartoon: "Pixar-style 3D cartoon wedding portrait of a happy young Asian couple, bride and groom, soft lighting, pastel pink background, cute and warm, head and shoulders, high quality, smiling, detailed eyes",
  oil:     "Classical European oil painting wedding portrait of an elegant young Asian couple in formal wedding attire, warm golden tones, soft brushstrokes, museum quality, head and shoulders",
  hk:      "1990s Hong Kong cinema wedding portrait of a young Asian couple, Wong Kar-wai style, cinematic film grain, warm gold lighting, retro fashion, dreamy bokeh, head and shoulders",
  line:    "Minimalist single-line ink illustration of a young Asian wedding couple, black ink on cream paper, elegant and clean, head and shoulders, no shading, modern wedding stationery style",
};

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 6)) return json(429, { ok: false, error: "生成过于频繁，请稍后再试" });
  if (env.AVATAR_ENABLED !== "true") return json(503, { ok: false, error: "AI 头像功能尚未开启" });
  if (!env.WEDDING) return serverError("KV not configured");

  // 全局每日成本兜底
  const limit = parseInt(env.AVATAR_DAILY_LIMIT || "200", 10);
  const today = new Date().toISOString().slice(0, 10);
  const counterKey = `cnt:avatar-${today}`;
  const used = parseInt((await env.WEDDING.get(counterKey)) || "0", 10);
  if (used >= limit) return json(429, { ok: false, error: "今日 AI 头像配额已用完，请明天再来" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }
  const style = STYLE_PROMPT[body?.style] ? body.style : "cartoon";
  const prompt = STYLE_PROMPT[style];
  const seed = Math.floor(Math.random() * 1_000_000);

  let dataUrl, provider;

  // 路线 A：Pollinations（无需 key，完全免费）
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=640&seed=${seed}&nologo=true&model=flux`;
    const r = await fetch(url, {
      cf: { cacheTtl: 0 },
      signal: AbortSignal.timeout(25_000),
    });
    if (r.ok) {
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 1000) {
        dataUrl = `data:${r.headers.get("content-type") || "image/jpeg"};base64,${arrayBufferToBase64(buf)}`;
        provider = "pollinations";
      }
    }
  } catch (_) { /* fallthrough */ }

  // 路线 B：Cloudflare Workers AI 兜底
  if (!dataUrl && env.AI) {
    try {
      const out = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 4 });
      if (out?.image) {
        dataUrl = `data:image/png;base64,${out.image}`;
        provider = "workers-ai";
      } else if (out instanceof ReadableStream) {
        const buf = await new Response(out).arrayBuffer();
        dataUrl = `data:image/png;base64,${arrayBufferToBase64(buf)}`;
        provider = "workers-ai";
      } else if (out instanceof Uint8Array || out instanceof ArrayBuffer) {
        const buf = out instanceof Uint8Array ? out.buffer : out;
        dataUrl = `data:image/png;base64,${arrayBufferToBase64(buf)}`;
        provider = "workers-ai";
      }
    } catch (_) { /* fallthrough */ }
  }

  if (!dataUrl) {
    return json(503, {
      ok: false,
      error: "AI 头像服务暂时不可用，请稍后再试。其他功能（请帖、AI 故事、婚纱照）不受影响。",
    });
  }

  await env.WEDDING.put(counterKey, String(used + 1), { expirationTtl: 86400 * 3 });
  return json(200, { ok: true, dataUrl, style, provider });
};
