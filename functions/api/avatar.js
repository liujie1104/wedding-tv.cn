// POST /api/avatar  body: { dataUrl } -> { ok, dataUrl, provider, hint }
// 两段式：Gemini 2.5 Flash 看合照写英文 prompt → Flux.1 Schnell 出极简线稿头像
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const VISION_MODEL = "gemini-2.5-flash";

const VISION_INSTRUCTION =
  "You are a wedding illustration prompt writer. Look at the uploaded photo of a couple and write " +
  "ONE concise English image-generation prompt (max 80 words, no line breaks). " +
  "Describe ONLY: the man's hairstyle and rough age, the woman's hairstyle and rough age, " +
  "their expressions and head positions (e.g. heads close together, looking at viewer). " +
  "Do NOT describe clothing colors, backgrounds, or photographic terms. " +
  "Output the prompt sentence only, no preface, no quotes, no markdown.";

const STYLE_SUFFIX =
  ", minimalist single continuous line drawing, exactly two people one man and one woman side by side, " +
  "head and shoulders portrait, elegant black ink lines on cream paper, " +
  "modern wedding stationery illustration, clean refined lines, no shading, no color fill, soft warm background";

const NEGATIVE =
  "three people, four people, group, crowd, multiple couples, extra heads, deformed, blurry, " +
  "low quality, color photo, photorealistic, oil painting, watercolor, text, watermark, logo";

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  return m ? { mime: m[1], b64: m[2] } : null;
}

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 6)) return json(429, { ok: false, error: "生成过于频繁，请稍后再试" });
  if (env.AVATAR_ENABLED !== "true") return json(503, { ok: false, error: "AI 头像功能尚未开启" });
  if (!env.WEDDING) return serverError("KV not configured");
  if (!env.AI) return json(503, { ok: false, error: "Workers AI 未绑定" });
  if (!env.GEMINI_API_KEY) return json(503, { ok: false, error: "Gemini key 未配置" });

  const limit = parseInt(env.AVATAR_DAILY_LIMIT || "200", 10);
  const today = new Date().toISOString().slice(0, 10);
  const counterKey = `cnt:avatar-${today}`;
  const used = parseInt((await env.WEDDING.get(counterKey)) || "0", 10);
  if (used >= limit) return json(429, { ok: false, error: "今日 AI 头像配额已用完，请明天再来" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }
  const decoded = parseDataUrl(body?.dataUrl);
  if (!decoded) return badRequest("请先上传一张你们的合照（jpeg/png/webp）");
  if (decoded.b64.length > 4_500_000) return badRequest("图片过大，请压缩后重试");

  // ===== 第 1 步：Gemini Vision 把合照转英文描述 =====
  let scenePrompt;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VISION_INSTRUCTION }] },
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: decoded.mime, data: decoded.b64 } },
              { text: "Write the prompt now." },
            ],
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 200,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || "Gemini 看图失败";
      // 配额耗尽就直接退化为通用 prompt
      if (/quota|rate.?limit/i.test(msg)) {
        scenePrompt = "a young Asian wedding couple, the groom with short black hair, the bride with elegant updo hair, both smiling warmly, heads close together looking at viewer";
      } else {
        return serverError(msg);
      }
    } else {
      scenePrompt = (data?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text).filter(Boolean).join(" ").trim();
      if (!scenePrompt || scenePrompt.length < 10) {
        scenePrompt = "a young Asian wedding couple, heads close together looking at viewer, gentle smiles";
      }
    }
  } catch (e) {
    return serverError(String(e?.message || e));
  }

  // ===== 第 2 步：Flux.1 Schnell 文生图 =====
  const finalPrompt = scenePrompt + STYLE_SUFFIX;
  let buf;
  try {
    const out = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: finalPrompt,
      negative_prompt: NEGATIVE,
      steps: 8,
    });
    if (out?.image) {
      const bytes = Uint8Array.from(atob(out.image), (c) => c.charCodeAt(0));
      buf = bytes.buffer;
    } else if (out instanceof ReadableStream) {
      buf = await new Response(out).arrayBuffer();
    } else if (out instanceof Uint8Array) {
      buf = out.buffer;
    } else if (out instanceof ArrayBuffer) {
      buf = out;
    } else {
      return serverError("AI 返回格式异常");
    }
  } catch (e) {
    return serverError(String(e?.message || e));
  }

  const dataUrl = `data:image/png;base64,${arrayBufferToBase64(buf)}`;

  await env.WEDDING.put(counterKey, String(used + 1), { expirationTtl: 86400 * 3 });
  return json(200, {
    ok: true,
    dataUrl,
    provider: "gemini-vision+flux-schnell",
    style: "line",
    hint: scenePrompt.slice(0, 200),
  });
};
