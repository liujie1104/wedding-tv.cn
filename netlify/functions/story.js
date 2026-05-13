// POST /api/story  body: { brief: "我们怎么认识的 50-200 字" }
// 返回 { ok, story }
// 调用 Gemini 2.5 Flash 把简介扩写为 200-300 字温馨爱情故事
import { json, badRequest, serverError, rateLimit, getIp } from "./_lib.js";

const MODEL = "gemini-2.5-flash";

export default async (req) => {
  if (req.method !== "POST") return badRequest("POST only");
  if (!rateLimit(getIp(req), 10, 60_000)) return json(429, { ok: false, error: "请稍后再试" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { ok: false, error: "AI 服务尚未配置（管理员请设置 GEMINI_API_KEY）" });

  let body;
  try { body = await req.json(); } catch { return badRequest("invalid json"); }
  const brief = (body?.brief || "").toString().slice(0, 600);
  const groom = (body?.groom || "").toString().slice(0, 30);
  const bride = (body?.bride || "").toString().slice(0, 30);
  if (brief.length < 5) return badRequest("请至少写 5 个字");

  const sys =
    "你是一位温柔的中文婚礼文案作家。请把用户提供的相识简介，扩写为 200-280 字的温馨爱情故事，" +
    "用第三人称叙述，风格清新、不浮夸、避免陈词滥调。直接输出正文，不要标题、不要 Markdown、不要引号。";
  const user =
    `新郎：${groom || "（未填）"}\n新娘：${bride || "（未填）"}\n相识简介：${brief}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 600 },
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

export const config = { path: "/api/story" };
