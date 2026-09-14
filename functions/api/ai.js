// POST /api/ai  body: { kind, ... } -> { ok, text, model }
// 主：阿里云百炼免费额度白名单模型
// 兜底：Google Gemini 2.5 Flash
import { json, badRequest, serverError, rateLimit, getIp, checkDailyQuota, readJsonBody } from "../_lib.js";
import {
  DEFAULT_BAILIAN_TEXT_MODEL,
  requireBailianBeijingBaseUrl,
  requireBailianModel,
} from "../_bailian-model-policy.js";

const QWEN_MODEL = DEFAULT_BAILIAN_TEXT_MODEL;
const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const GEMINI_MODEL = "gemini-2.5-flash";

const PROMPTS = {
  vows: ({ groom, bride, story, style, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are an experienced wedding vow writer. Write a heartfelt, personal set of wedding vows to be spoken aloud during a wedding ceremony.\n" +
          "Output only the vow text itself. Do not include titles, markdown headings, quotes, or explanatory notes.\n" +
          "Write in the first person ('I'), speaking directly to the partner. Warm, sincere, romantic, and authentic.\n" +
          "Keep length between 160 and 260 words, divided into 3 to 4 natural paragraphs.",
        user:
          `Partner 1 (Speaker): ${groom || "Partner 1"}\nPartner 2: ${bride || "Partner 2"}\n` +
          `Love Story / Key Thoughts: ${story || "A loving journey together"}\n` +
          `Tone / Style: ${style || "Heartfelt and sincere"}`,
        cfg: { temperature: 0.9, maxTokens: 800 },
      };
    }
    return {
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
    };
  },
  checklist: ({ city, date, budget, guests, style, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are a professional wedding planning assistant. Based on the user's inputs, generate a practical draft wedding checklist organized by planning stages.\n" +
          "Strictly format your response in Markdown as follows, without intro or conclusion:\n\n" +
          "## 6 Months Before\n- [ ] Task 1\n- [ ] Task 2\n\n" +
          "## 3 Months Before\n...\n\n## 1 Month Before\n...\n\n## 1 Week Before\n...\n\n## Wedding Day\n...\n\n" +
          "Each stage must have 5-8 actionable tasks. Strict constraints:\n" +
          "1. Never recommend, name, or endorse specific hotels, venues, wedding planners, photographers, or commercial brands;\n" +
          "2. Never generate claims of specific local market pricing ranges as facts;\n" +
          "3. When discussing budget, only allocate percentages as adjustable planning references based on total budget (or typical benchmarks if omitted), noting they are planning examples;\n" +
          "4. Frame location-specific requirements as items to confirm with local authorities, venues, or families.",
        user:
          `Location: ${city || "Not specified"}\nWedding Date: ${date || "Not specified"}\n` +
          `Total Budget: ${budget || "Not specified"}\nGuest Count: ${guests || "Not specified"}\n` +
          `Wedding Style: ${style || "Not specified"}`,
        cfg: { temperature: 0.5, maxTokens: 1800 },
      };
    }
    return {
      sys:
        "你是一位婚礼筹备流程规划助手。请基于用户输入的城市、婚期、预算、人数与风格，输出一份按筹备阶段组织的初稿任务清单。" +
        "严格按照如下 Markdown 结构输出，不要前言不要总结：\n\n" +
        "## 距婚礼 6 个月\n- [ ] 任务 1\n- [ ] 任务 2\n\n" +
        "## 距婚礼 3 个月\n…\n\n## 距婚礼 1 个月\n…\n\n## 距婚礼 1 周\n…\n\n## 婚礼当天\n…\n\n" +
        "每个阶段 5~8 条任务，严格遵守以下约束：\n" +
        "1. 绝不推荐、提及或点名任何具体酒店、宴会厅、婚庆公司、摄影团队、化妆师或第三方商业品牌；\n" +
        "2. 绝不生成声称代表当地市场行情的具体价格区间或人均金额；\n" +
        "3. 涉及费用时，仅按用户输入的总预算分配为可调整的规划参考比例（如场地宴席约 40%~50%），并明确注明是规划示例而非市场实价；若用户未填预算则仅给出推荐比例；\n" +
        "4. 涉及城市与本地事项时，一律表述为向当地婚姻登记机关、预订场地或双方家庭长辈沟通确认的核对待办，绝不自行断言地方习俗或规定。",
      user:
        `城市：${city || "未填"}\n婚期：${date || "未填"}\n` +
        `总预算：${budget || "未填"} 元\n宾客人数：${guests || "未填"}\n` +
        `婚礼风格：${style || "未填"}`,
      cfg: { temperature: 0.5, maxTokens: 1800 },
    };
  },
  toast: ({ speaker, couple, relation, story, mood, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are a professional speechwriter. Write a warm and memorable wedding toast to be given to the newlyweds.\n" +
          "Output only the speech text. Do not include titles, markdown headings, or explanations. 140-220 words, 2-4 natural paragraphs, conversational tone, ending with a celebratory toast.",
        user:
          `Speaker: ${speaker || "Not specified"}\nRelationship to Couple: ${relation || "Friend / Family"}\n` +
          `Couple: ${couple || "Newlyweds"}\nStory / Impression: ${story || "Shared memories"}\n` +
          `Tone: ${mood || "Warm and celebratory"}`,
        cfg: { temperature: 0.85, maxTokens: 700 },
      };
    }
    return {
      sys:
        "你是中文婚礼文案专家。写一段婚礼现场敬酒词，由说话人对新人说。" +
        "只输出正文，不要标题、不要解释、不要 Markdown。140~220 字，2~4 段，自然口语，结尾有祝福。",
      user:
        `说话人：${speaker || "未填"}\n与新人关系：${relation || "未填"}\n` +
        `新人：${couple || "未填"}\n想分享的故事/印象：${story || "未填"}\n` +
        `情绪基调：${mood || "温暖真挚"}`,
      cfg: { temperature: 0.85, maxTokens: 700 },
    };
  },
  host: ({ couple, venue, style, highlights, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are an experienced wedding Master of Ceremonies (MC). Write a welcoming ceremony opening speech that transitions guests from silence to welcoming the newlyweds.\n" +
          "Output only the speech text. Do not include titles, markdown, or explanations. 160-240 words, 3-4 natural paragraphs, engaging rhythm and warm emotion.",
        user:
          `Couple: ${couple || "Newlyweds"}\nVenue / Setting: ${venue || "Ceremony Venue"}\n` +
          `Style / Theme: ${style || "Classic & Elegant"}\nHighlights: ${highlights || "Warm celebration with family and friends"}`,
        cfg: { temperature: 0.85, maxTokens: 800 },
      };
    }
    return {
      sys:
        "你是资深婚礼司仪。请写一段婚礼开场白，从全场静默到引出新人入场。" +
        "只输出正文，不要标题不要解释。180~280 字，3~5 段，节奏感强，富有画面，带情绪起伏。",
      user:
        `新人：${couple || "未填"}\n场地：${venue || "未填"}\n` +
        `风格：${style || "未填"}\n要突出的亮点：${highlights || "未填"}`,
      cfg: { temperature: 0.85, maxTokens: 800 },
    };
  },
  parents: ({ side, child, partner, story, hope, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are a thoughtful wedding speechwriter. Write a moving speech from the parent of the bride or groom, addressing their child and welcoming their new spouse into the family.\n" +
          "Output only the speech text. Do not include titles, markdown, or explanations. 160-250 words, 3-4 paragraphs covering cherished childhood memories, welcoming the new partner, and blessing their future together.",
        user:
          `Speaker / Role: ${side || "Parent of the Bride / Groom"}\n` +
          `Child's Name: ${child || "Our child"}\nPartner's Name: ${partner || "New spouse"}\n` +
          `Cherished Memories: ${story || "Growing up together"}\nHopes & Wishes: ${hope || "Lifelong happiness and companionship"}`,
        cfg: { temperature: 0.8, maxTokens: 800 },
      };
    }
    return {
      sys:
        "你是中文婚礼文案专家。请写一段父母在婚礼上对儿女与新伴侣的致辞。" +
        "只输出正文，不要标题不要解释。180~260 字，3~4 段，含回忆、托付、祝福三层。",
      user:
        `发言方：${side || "未填"}（如：新娘父亲 / 新郎母亲）\n` +
        `自己孩子的名字：${child || "未填"}\n伴侣名字：${partner || "未填"}\n` +
        `想分享的成长往事：${story || "未填"}\n对小两口的期盼：${hope || "未填"}`,
      cfg: { temperature: 0.8, maxTokens: 800 },
    };
  },
  bestman: ({ role, speaker, friend, story, joke, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are a skilled speechwriter. Write an engaging Best Man or Maid of Honor speech for a wedding reception.\n" +
          "Output only the speech text. Do not include titles, markdown, or explanations. 160-240 words, 2-4 paragraphs, starting with lighthearted warmth or a funny memory, moving into genuine gratitude, and ending with a heartfelt toast.",
        user:
          `Role: ${role || "Best Man / Maid of Honor"}\nSpeaker: ${speaker || "Friend"}\n` +
          `Friend (Bride or Groom): ${friend || "Dear Friend"}\nMemories / Stories: ${story || "Years of friendship"}\n` +
          `Lighthearted joke or nuance (optional): ${joke || "None"}`,
        cfg: { temperature: 0.9, maxTokens: 700 },
      };
    }
    return {
      sys:
        "你是中文婚礼文案专家。请写一段伴郎或伴娘的致辞。" +
        "只输出正文，不要标题不要解释。160~240 字，2~4 段，前半带轻松幽默或趣事，后半真情祝福。",
      user:
        `角色：${role || "伴郎"}\n说话人：${speaker || "未填"}\n` +
        `好友（新人之一）名字：${friend || "未填"}\n想讲的故事/共同回忆：${story || "未填"}\n` +
        `可以带一点的玩笑/梗（可选）：${joke || ""}`,
      cfg: { temperature: 0.9, maxTokens: 700 },
    };
  },
  proposal: ({ me, partner, story, place, style, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are an emotional and eloquent writer. Write a marriage proposal speech to be spoken directly to a partner.\n" +
          "Output only the speech text in first person. Do not include titles, markdown, or explanations. 120-180 words, 2-3 paragraphs, concluding with a clear question asking to spend life together.",
        user:
          `Me: ${me || "Speaker"}\nPartner: ${partner || "Beloved"}\n` +
          `Our Journey: ${story || "Years of shared love and support"}\nProposal Setting: ${place || "Special romantic location"}\n` +
          `Tone / Style: ${style || "Heartfelt and romantic"}`,
        cfg: { temperature: 0.9, maxTokens: 600 },
      };
    }
    return {
      sys:
        "你是中文情感文案专家。写一段在求婚现场对伴侣说的求婚词。" +
        "只输出正文，不要标题不要解释不要 Markdown。120~200 字，2~3 段，第一人称，结尾要有'你愿意嫁/娶我吗'类似的明确发问。",
      user:
        `我：${me || "未填"}\nTA：${partner || "未填"}\n` +
        `共同故事：${story || "未填"}\n求婚地点：${place || "未填"}\n` +
        `风格偏好：${style || "深情"}`,
      cfg: { temperature: 0.9, maxTokens: 600 },
    };
  },
  anniversary: ({ years, partner, highlight, tone, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are a warm relationship writer. Write a wedding anniversary message in first person to a spouse.\n" +
          "Output only the message text. Do not include titles, markdown, or explanations. 80-140 words, 1-2 paragraphs, sincere and memorable.",
        user:
          `Years Married: ${years || "1"}\nPartner: ${partner || "My love"}\n` +
          `Cherished Moments: ${highlight || "Every everyday adventure"}\nTone: ${tone || "Warm and romantic"}`,
        cfg: { temperature: 0.9, maxTokens: 500 },
      };
    }
    return {
      sys:
        "你是中文情感文案专家。写一段结婚周年纪念短信/朋友圈文案，第一人称对伴侣说。" +
        "只输出正文，不要标题不要解释。80~140 字，2 段以内，文字凝练有画面感。",
      user:
        `已结婚：${years || "未填"} 年\n伴侣：${partner || "未填"}\n` +
        `想纪念的瞬间/想表达的：${highlight || "未填"}\n基调：${tone || "温暖"}`,
      cfg: { temperature: 0.9, maxTokens: 500 },
    };
  },
  invitationCopy: ({ groom, bride, date, city, venue, style, story, lang, locale }) => {
    if (lang === "en" || locale === "en") {
      return {
        sys:
          "You are a professional wedding invitation copywriter. Draft ready-to-use invitation copy for the couple.\n" +
          "Output strictly formatted Markdown with headings: ## Invitation Title, ## Formal Invitation, ## Ceremony Details, ## Social Media Announcement, ## Text / WhatsApp Message.\n" +
          "Keep language warm, elegant, concise, and ready to send. Never invent non-existent commercial venues.",
        user:
          `Groom: ${groom || "Partner A"}\nBride: ${bride || "Partner B"}\nWedding Date: ${date || "Date"}\n` +
          `City: ${city || "City"}\nVenue: ${venue || "Venue"}\nStyle: ${style || "Elegant & Modern"}\n` +
          `Love Story / Focus: ${story || "Celebrating our love with family and friends"}`,
        cfg: { temperature: 0.82, maxTokens: 1200 },
      };
    }
    return {
      sys:
        "你是中文婚礼请帖文案策划。请为电子请帖生成可直接使用的文案。" +
        "输出 Markdown，结构固定为：## 请帖标题、## 开场邀请、## 婚礼信息、## 朋友圈分享文案、## 短信/微信邀请。" +
        "文字要体面、温暖、适合新人直接复制，不要夸张营销，不要虚构具体地址。每个版本都要简洁。",
      user:
        `新郎：${groom || "未填"}\n新娘：${bride || "未填"}\n婚期：${date || "未填"}\n` +
        `城市：${city || "未填"}\n场地：${venue || "未填"}\n风格：${style || "温柔正式"}\n` +
        `爱情故事/想表达的重点：${story || "未填"}`,
      cfg: { temperature: 0.82, maxTokens: 1200 },
    };
  },
  weddingPlan: ({ city, date, budget, guests, style, priorities }) => ({
    sys:
      "你是婚礼统筹规划助手。请基于新人输入，生成一份可执行的婚礼筹备方案。" +
      "输出 Markdown，必须包含：## 方案定位、## 预算拆分、## 当天流程、## 服务商选择原则、## 风险提醒、## 下一步清单。" +
      "预算拆分仅按用户总预算给出参考比例与规划示例；流程按时间段组织；绝不推荐或点名具体酒店或商业品牌；绝不虚构当地市场价格区间；地方事项提醒向场地与双方家庭核对。" +
      "如果信息缺失，用合理假设并明确写出假设。",
    user:
      `城市：${city || "未填"}\n婚期：${date || "未填"}\n总预算：${budget || "未填"}\n` +
      `宾客人数：${guests || "未填"}\n婚礼风格：${style || "未填"}\n优先事项：${priorities || "未填"}`,
    cfg: { temperature: 0.72, maxTokens: 2200 },
  }),
  cityPlan: ({ city, season, budget, guests, customs, focus }) => ({
    sys:
      "你是熟悉中国城市婚俗和婚礼预算的编辑型策划师。请生成一个城市婚礼方案。" +
      "输出 Markdown，必须包含：## 城市婚礼特点、## 婚俗沟通清单、## 预算建议、## 场地与服务商选择、## 视频/直播建议、## 可分享给家人的确认清单。" +
      "避免编造具体商家；如涉及地方习俗，使用'建议与双方长辈和当地团队确认'的表述。",
    user:
      `城市：${city || "未填"}\n季节：${season || "未填"}\n预算：${budget || "未填"}\n` +
      `宾客人数：${guests || "未填"}\n已知习俗/家庭要求：${customs || "未填"}\n重点关注：${focus || "预算、流程、婚俗"}`,
    cfg: { temperature: 0.7, maxTokens: 2000 },
  }),
};

// ---------- 模型适配 ----------
async function callQwen({ key, baseUrl, model, sys, user, cfg }) {
  const selectedModel = requireBailianModel(model || QWEN_MODEL, "text-generation");
  const root = requireBailianBeijingBaseUrl(baseUrl || QWEN_BASE_URL).href.replace(/\/+$/, "");
  const r = await fetch(
    `${root}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: selectedModel.code,
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
  const ip = getIp(request);
  if (!rateLimit(ip, 12)) return json(429, { ok: false, error: "请求过于频繁，请稍后再试" });

  const qwenKey = env.DASHSCOPE_API_KEY;
  const qwenBaseUrl = env.BAILIAN_BASE_URL || env.DASHSCOPE_BASE_URL || QWEN_BASE_URL;
  const qwenModel = env.BAILIAN_MODEL || env.DASHSCOPE_MODEL || QWEN_MODEL;
  const geminiKey = env.GEMINI_API_KEY;
  if (!qwenKey && !geminiKey) return json(503, { ok: false, error: "AI 服务尚未配置" });

  if (qwenKey) {
    try {
      requireBailianModel(qwenModel, "text-generation");
      requireBailianBeijingBaseUrl(qwenBaseUrl);
    } catch (e) {
      return json(503, { ok: false, error: String(e?.message || e) });
    }
  }

  const { data: body, err } = await readJsonBody(request, 8192);
  if (err === "payload_too_large") return json(413, { ok: false, error: "请求内容过大" });
  if (err) return badRequest("invalid json");

  const kind = String(body?.kind || "");
  const builder = PROMPTS[kind];
  if (!builder) return badRequest("unsupported kind");

  const { sys, user: rawUser, cfg } = builder(body || {});
  if (!rawUser || rawUser.length < 5) return badRequest("内容太少");
  const user = String(rawUser).slice(0, 1500);

  // 只有在请求合法有效之后，才扣除日额度（避免无效请求刷爆配额）
  const allowed = await checkDailyQuota(env, ip, "ai", 30, 1000);
  if (!allowed) return json(429, { ok: false, error: "今日免费 AI 额度已达上限，请明日再试" });

  // 优先 qwen，失败兜底 gemini
  const order = [];
  if (qwenKey) order.push({ name: qwenModel, fn: () => callQwen({ key: qwenKey, baseUrl: qwenBaseUrl, model: qwenModel, sys, user, cfg }) });
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
