// POST /api/avatar  body: { dataUrl, style } -> { ok, dataUrl }
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const MODEL = "gemini-2.5-flash-image";

const STYLES = {
  cartoon: "Convert into a cute Pixar-style 3D cartoon avatar, soft lighting, pastel background, head and shoulders only, friendly smile, high detail eyes.",
  oil:     "Transform into a classical oil painting portrait avatar in the style of European wedding portraits, warm tones, soft brushwork, head and shoulders only.",
  hk:      "Restyle as a 1990s Hong Kong cinema portrait, cinematic film grain, warm gold lighting, retro fashion, head and shoulders avatar, dreamy bokeh.",
  line:    "Convert into a clean minimalist single-line illustration avatar, black ink on cream paper, elegant, head and shoulders only, no shading.",
};

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 4)) return json(429, { ok: false, error: "生成过于频繁，请稍后" });
  if (env.AVATAR_ENABLED !== "true") return json(503, { ok: false, error: "AI 头像功能尚未开启" });
  const key = env.GEMINI_API_KEY;
  if (!key) return json(503, { ok: false, error: "AI 服务尚未配置" });
  if (!env.WEDDING) return serverError("KV not configured");

  // 全局每日成本兜底
  const limit = parseInt(env.AVATAR_DAILY_LIMIT || "200", 10);
  const today = new Date().toISOString().slice(0, 10);
  const counterKey = `cnt:avatar-${today}`;
  const used = parseInt((await env.WEDDING.get(counterKey)) || "0", 10);
  if (used >= limit) return json(429, { ok: false, error: "今日 AI 头像配额已用完，请明天再来" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }
  const dataUrl = body?.dataUrl;
  const style = STYLES[body?.style] ? body.style : "cartoon";
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/"))
    return badRequest("bad dataUrl");
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return badRequest("only jpeg/png/webp accepted");
  if (dataUrl.length > 4_500_000) return badRequest("图片过大，请压缩后再试");

  const prompt = STYLES[style];

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: m[1], data: m[2] } },
            ],
          }],
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) return serverError(data?.error?.message || "AI 调用失败");
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart) return serverError("AI 未返回图片，请换一张更清晰的合照重试");
    const outMime = imgPart.inlineData.mimeType || "image/png";
    const outDataUrl = `data:${outMime};base64,${imgPart.inlineData.data}`;

    // 计数 +1（3 天后过期，自动清理）
    await env.WEDDING.put(counterKey, String(used + 1), { expirationTtl: 86400 * 3 });
    return json(200, { ok: true, dataUrl: outDataUrl, style });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
