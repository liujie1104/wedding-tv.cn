// POST /api/avatar  body: { dataUrl } -> { ok, dataUrl, provider, hint }
// 两段式：Gemini 2.5 Flash 看合照写英文 prompt → Flux.1 Schnell 出极简线稿头像
import { json, badRequest, serverError, rateLimit, getIp, checkDailyQuota, readJsonBody } from "../_lib.js";

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
  const ip = getIp(request);
  if (!rateLimit(ip, 6)) return json(429, { ok: false, error: "生成过于频繁，请稍后再试" });
  if (env.AVATAR_ENABLED !== "true") return json(503, { ok: false, error: "AI 头像功能尚未开启" });
  const kv = env.WEDDING || env.WEDDING_KV;
  if (!kv) return serverError("KV not configured");
  if (!env.AI) return json(503, { ok: false, error: "Workers AI 未绑定" });
  if (!env.GEMINI_API_KEY) return json(503, { ok: false, error: "Gemini key 未配置" });

  const { data: body, err } = await readJsonBody(request, 5_000_000);
  if (err === "payload_too_large") return json(413, { ok: false, error: "图片过大，请压缩后重试（最大 5MB）" });
  if (err) return badRequest("invalid json");

  const decoded = parseDataUrl(body?.dataUrl);
  if (!decoded) return badRequest("请先上传一张你们的合照（jpeg/png/webp）");
  if (decoded.b64.length > 4_500_000) return badRequest("图片数据过大，请压缩后重试");

  // 校验通过后扣除每日配额（单 IP 5 次/天，全站根据配置限额）
  const maxLimit = parseInt(env.AVATAR_DAILY_LIMIT || "200", 10);
  const allowed = await checkDailyQuota(env, ip, "avatar", 5, maxLimit);
  if (!allowed) return json(429, { ok: false, error: "今日 AI 头像配额已用完，请明天再来" });

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
    if (!r.ok) return serverError(data?.error?.message || "合照分析失败");
    scenePrompt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!scenePrompt) return serverError("未能从合照中提取特征");
  } catch (e) {
    return serverError(`Gemini 视觉分析异常：${e?.message || e}`);
  }

  // ===== 第 2 步：Cloudflare Workers AI (Flux.1 Schnell) 出图 =====
  const fullPrompt = `${scenePrompt}${STYLE_SUFFIX}`;
  try {
    const imgBuf = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: fullPrompt,
      steps: 4,
    });
    // flux-1-schnell 返回 Uint8Array / ArrayBuffer (JPEG) 或 { image: "base64..." }
    let outDataUrl;
    if (imgBuf instanceof ArrayBuffer || imgBuf instanceof Uint8Array) {
      outDataUrl = `data:image/jpeg;base64,${arrayBufferToBase64(imgBuf)}`;
    } else if (imgBuf?.image) {
      outDataUrl = `data:image/jpeg;base64,${imgBuf.image}`;
    } else {
      return serverError("Workers AI 未返回图像数据");
    }

    return json(200, {
      ok: true,
      dataUrl: outDataUrl,
      provider: "gemini+flux",
      hint: "简约单线画风格头像已生成",
    });
  } catch (e) {
    return serverError(`图像生成失败：${e?.message || e}`);
  }
};
