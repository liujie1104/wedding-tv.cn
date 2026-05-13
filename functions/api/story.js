// POST /api/story  body: { brief, groom, bride } -> { ok, story }
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const MODEL = "gemini-2.5-flash";

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 10)) return json(429, { ok: false, error: "请稍后再试" });
  const key = env.GEMINI_API_KEY;
  if (!key) return json(503, { ok: false, error: "AI 服务尚未配置" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }
  const brief = (body?.brief || "").toString().slice(0, 600);
  const groom = (body?.groom || "").toString().slice(0, 30);
  const bride = (body?.bride || "").toString().slice(0, 30);
  if (brief.length < 5) return badRequest("请至少写 5 个字");

  const sys =
    "你是一位温柔的中文婚礼文案作家。请把用户提供的相识简介，扩写为 200-280 字的温馨爱情故事，" +
    "用第三人称叙述，风格清新、不浮夸、避免陈词滥调。直接输出正文，不要标题、不要 Markdown、不要引号。";
  const user = `新郎：${groom || "（未填）"}\n新娘：${bride || "（未填）"}\n相识简介：${brief}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 1200,
            // 关闭 Gemini 2.5 默认 thinking，避免 output token 被思考吃掉导致正文被截断
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) return serverError(data?.error?.message || "AI 调用失败");
    const story = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n").trim();
    if (!story) return serverError("AI 没有返回内容，请重试");
    return json(200, { ok: true, story });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
