// POST /api/ai  body: { kind, ... } -> { ok, text }
// kind = "vows" | "checklist"
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const MODEL = "gemini-2.5-flash";

const PROMPTS = {
  vows: ({ groom, bride, story, style }) => ({
    sys:
      "你是一位资深的中文婚礼文案作家。请根据用户提供的信息，写一段在婚礼现场可朗读的爱情誓词。" +
      "只输出誓词正文，不要标题、不要 Markdown、不要引号、不要解释。" +
      "用第一人称（'我'）对着伴侣说，温柔真挚、有画面感、避免空话套话。" +
      "全文 180~260 字，用 3~5 个自然段（用空行分段）。",
    user:
      `新郎：${groom || "（未填）"}\n新娘：${bride || "（未填）"}\n` +
      `恋爱故事 / 想表达的：${story}\n` +
      `风格偏好：${style || "深情真挚"}`,
    cfg: { temperature: 0.9, maxOutputTokens: 800 },
  }),
  checklist: ({ city, date, budget, guests, style }) => ({
    sys:
      "你是一位资深婚礼策划师。请基于用户输入，输出一份**个性化、可执行**的婚礼倒计时筹备清单。" +
      "严格按照如下 Markdown 结构输出，不要前言不要总结：\n\n" +
      "## 距婚礼 6 个月\n- [ ] 任务 1\n- [ ] 任务 2\n\n" +
      "## 距婚礼 3 个月\n…\n\n## 距婚礼 1 个月\n…\n\n## 距婚礼 1 周\n…\n\n## 婚礼当天\n…\n\n" +
      "每个阶段 5~8 条任务，结合用户填写的城市、预算、风格给出**具体**建议（如具体金额范围、本地建议）。",
    user:
      `城市：${city || "未填"}\n婚期：${date || "未填"}\n` +
      `总预算：${budget || "未填"} 元\n宾客人数：${guests || "未填"}\n` +
      `婚礼风格：${style || "未填"}`,
    cfg: { temperature: 0.7, maxOutputTokens: 1800 },
  }),
};

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 12)) return json(429, { ok: false, error: "请稍后再试" });
  const key = env.GEMINI_API_KEY;
  if (!key) return json(503, { ok: false, error: "AI 服务尚未配置" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }
  const kind = String(body?.kind || "");
  const builder = PROMPTS[kind];
  if (!builder) return badRequest("unsupported kind");

  const { sys, user, cfg } = builder(body || {});
  if (!user || user.length < 5) return badRequest("内容太少");

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
            ...cfg,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) return serverError(data?.error?.message || "AI 调用失败");
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n").trim();
    if (!text) return serverError("AI 没有返回内容，请重试");
    return json(200, { ok: true, text });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
