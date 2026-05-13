// POST /api/avatar  body: { dataUrl } -> { ok, dataUrl, provider }
// 图生图：用上传的合照做底稿，输出极简线稿风格的两人婚礼头像
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const PROMPT =
  "minimalist single continuous line drawing of a romantic young wedding couple, " +
  "exactly two people, one man and one woman side by side, head and shoulders portrait, " +
  "elegant black ink lines on cream paper, modern wedding stationery illustration, " +
  "clean and refined, no shading, no color fill, soft warm background";

const NEGATIVE =
  "three people, four people, group of people, crowd, multiple couples, " +
  "extra heads, extra faces, deformed, disfigured, blurry, low quality, " +
  "color photo, photorealistic, painting, oil painting, watercolor, " +
  "text, watermark, signature, logo";

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function dataUrlToBytes(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { mime: m[1], bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
}

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 6)) return json(429, { ok: false, error: "生成过于频繁，请稍后再试" });
  if (env.AVATAR_ENABLED !== "true") return json(503, { ok: false, error: "AI 头像功能尚未开启" });
  if (!env.WEDDING) return serverError("KV not configured");
  if (!env.AI) return json(503, { ok: false, error: "Workers AI 未绑定，请在 Cloudflare 添加 AI binding" });

  // 全局每日成本兜底
  const limit = parseInt(env.AVATAR_DAILY_LIMIT || "200", 10);
  const today = new Date().toISOString().slice(0, 10);
  const counterKey = `cnt:avatar-${today}`;
  const used = parseInt((await env.WEDDING.get(counterKey)) || "0", 10);
  if (used >= limit) return json(429, { ok: false, error: "今日 AI 头像配额已用完，请明天再来" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }

  const decoded = dataUrlToBytes(body?.dataUrl);
  if (!decoded) return badRequest("请先上传一张你们的合照（jpeg/png/webp）");
  if (decoded.bytes.length > 3_500_000) return badRequest("图片过大，请压缩后重试");

  try {
    // Workers AI img2img：把上传图片作为底稿，按 prompt 重绘
    const out = await env.AI.run("@cf/runwayml/stable-diffusion-v1-5-img2img", {
      prompt: PROMPT,
      negative_prompt: NEGATIVE,
      image: Array.from(decoded.bytes),
      strength: 0.75,    // 0-1，越高越像 prompt、越不像原图
      num_steps: 20,
      guidance: 8.5,
    });

    let buf;
    if (out instanceof ReadableStream) buf = await new Response(out).arrayBuffer();
    else if (out instanceof Uint8Array) buf = out.buffer;
    else if (out instanceof ArrayBuffer) buf = out;
    else if (out?.image) {
      // 极少数情况下返回 base64 字符串
      const bytes = Uint8Array.from(atob(out.image), (c) => c.charCodeAt(0));
      buf = bytes.buffer;
    } else {
      return serverError("AI 返回格式异常，请重试");
    }

    const dataUrl = `data:image/png;base64,${arrayBufferToBase64(buf)}`;

    await env.WEDDING.put(counterKey, String(used + 1), { expirationTtl: 86400 * 3 });
    return json(200, { ok: true, dataUrl, provider: "workers-ai-img2img", style: "line" });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
