// POST /api/ai  body: { kind, ... } -> { ok, text, model }
// 主：阿里云百炼 qwen-plus（中文好、免费额度大）
// 兜底：Google Gemini 2.5 Flash
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

const QWEN_MODEL = "qwen-plus";
const GEMINI_MODEL = "gemini-2.5-flash";

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
    cfg: { temperature: 0.9, maxTokens: 800 },
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
    cfg: { temperature: 0.7, maxTokens: 1800 },
  }),
  toast: ({ speaker, couple, relation, story, mood }) => ({
    sys:
      "你是中文婚礼文案专家。写一段婚礼现场敬酒词，由说话人对新人说。" +
      "只输出正文，不要标题、不要解释、不要 Markdown。140~220 字，2~4 段，自然口语，结尾有祝福。",
    user:
      `说话人：${speaker || "未填"}\n与新人关系：${relation || "未填"}\n` +
      `新人：${couple || "未填"}\n想分享的故事/印象：${story || "未填"}\n` +
      `情绪基调：${mood || "温暖真挚"}`,
    cfg: { temperature: 0.85, maxTokens: 700 },
  }),
  host: ({ couple, venue, style, highlights }) => ({
    sys:
      "你是资深婚礼司仪。请写一段婚礼开场白，从全场静默到引出新人入场。" +
      "只输出正文，不要标题不要解释。180~280 字，3~5 段，节奏感强，富有画面，带情绪起伏。",
    user:
      `新人：${couple || "未填"}\n场地：${venue || "未填"}\n` +
      `风格：${style || "未填"}\n要突出的亮点：${highlights || "未填"}`,
    cfg: { temperature: 0.85, maxTokens: 800 },
  }),
  parents: ({ side, child, partner, story, hope }) => ({
    sys:
      "你是中文婚礼文案专家。请写一段父母在婚礼上对儿女与新伴侣的致辞。" +
      "只输出正文，不要标题不要解释。180~260 字，3~4 段，含回忆、托付、祝福三层。",
    user:
      `发言方：${side || "未填"}（如：新娘父亲 / 新郎母亲）\n` +
      `自己孩子的名字：${child || "未填"}\n伴侣名字：${partner || "未填"}\n` +
      `想分享的成长往事：${story || "未填"}\n对小两口的期盼：${hope || "未填"}`,
    cfg: { temperature: 0.8, maxTokens: 800 },
  }),
  bestman: ({ role, speaker, friend, story, joke }) => ({
    sys:
      "你是中文婚礼文案专家。请写一段伴郎或伴娘的致辞。" +
      "只输出正文，不要标题不要解释。160~240 字，2~4 段，前半带轻松幽默或趣事，后半真情祝福。",
    user:
      `角色：${role || "伴郎"}\n说话人：${speaker || "未填"}\n` +
      `好友（新人之一）名字：${friend || "未填"}\n想讲的故事/共同回忆：${story || "未填"}\n` +
      `可以带一点的玩笑/梗（可选）：${joke || ""}`,
    cfg: { temperature: 0.9, maxTokens: 700 },
  }),
  proposal: ({ me, partner, story, place, style }) => ({
    sys:
      "你是中文情感文案专家。写一段在求婚现场对伴侣说的求婚词。" +
      "只输出正文，不要标题不要解释不要 Markdown。120~200 字，2~3 段，第一人称，结尾要有'你愿意嫁/娶我吗'类似的明确发问。",
    user:
      `我：${me || "未填"}\nTA：${partner || "未填"}\n` +
      `共同故事：${story || "未填"}\n求婚地点：${place || "未填"}\n` +
      `风格偏好：${style || "深情"}`,
    cfg: { temperature: 0.9, maxTokens: 600 },
  }),
  anniversary: ({ years, partner, highlight, tone }) => ({
    sys:
      "你是中文情感文案专家。写一段结婚周年纪念短信/朋友圈文案，第一人称对伴侣说。" +
      "只输出正文，不要标题不要解释。80~140 字，2 段以内，文字凝练有画面感。",
    user:
      `已结婚：${years || "未填"} 年\n伴侣：${partner || "未填"}\n` +
      `想纪念的瞬间/想表达的：${highlight || "未填"}\n基调：${tone || "温暖"}`,
    cfg: { temperature: 0.9, maxTokens: 500 },
  }),
};

// ---------- 模型适配 ----------
async function callQwen({ key, sys, user, cfg }) {
  const r = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: cfg.temperature ?? 0.8,
        max_tokens: cfg.maxTokens ?? 800,
      }),
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || data?.message || "qwen 调用失败");
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("qwen 未返回内容");
  return text;
}

async function callGemini({ key, sys, user, cfg }) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: cfg.temperature ?? 0.8,
          maxOutputTokens: cfg.maxTokens ?? 800,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "gemini 调用失败");
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n").trim();
  if (!text) throw new Error("gemini 未返回内容");
  return text;
}

export const onRequestPost = async ({ request, env }) => {
  if (!rateLimit(getIp(request), 12)) return json(429, { ok: false, error: "请稍后再试" });

  const qwenKey = env.DASHSCOPE_API_KEY;
  const geminiKey = env.GEMINI_API_KEY;
  if (!qwenKey && !geminiKey) return json(503, { ok: false, error: "AI 服务尚未配置" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }
  const kind = String(body?.kind || "");
  const builder = PROMPTS[kind];
  if (!builder) return badRequest("unsupported kind");

  const { sys, user, cfg } = builder(body || {});
  if (!user || user.length < 5) return badRequest("内容太少");

  // 优先 qwen，失败兜底 gemini
  const order = [];
  if (qwenKey) order.push({ name: "qwen-plus", fn: () => callQwen({ key: qwenKey, sys, user, cfg }) });
  if (geminiKey) order.push({ name: "gemini-2.5-flash", fn: () => callGemini({ key: geminiKey, sys, user, cfg }) });

  let lastErr;
  for (const { name, fn } of order) {
    try {
      const text = await fn();
      return json(200, { ok: true, text, model: name });
    } catch (e) {
      lastErr = e;
    }
  }
  return serverError(String(lastErr?.message || lastErr || "AI 调用失败"));
};
