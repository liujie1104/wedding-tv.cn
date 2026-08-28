// AI 婚礼海报生成 - 基于阿里云百炼万相 wanx2.1-t2i-turbo
// POST /api/poster        body: { groom, bride, date, venue, style, color, size }  -> { ok, taskId }
// GET  /api/poster?id=xxx                                                          -> { ok, status, imageUrl?, error? }
import { json, badRequest, serverError, rateLimit, getIp, checkDailyQuota, readJsonBody } from "../_lib.js";

const MODEL = "wanx2.1-t2i-turbo";
const SIZES = {
  portrait:  "720*1280",
  landscape: "1280*720",
  square:    "1024*1024",
};

const STYLES = {
  rose:      "rose pink and gold",
  ink:       "Chinese ink wash, traditional Chinese style, red and gold",
  forest:    "lush forest green and cream, botanical wedding",
  ocean:     "ocean blue, beach wedding, soft sunset",
  vintage:   "vintage cream and burgundy, art-deco wedding",
  modern:    "modern minimalist, white and champagne",
  cyber:     "futuristic, neon purple and cyan",
};

function buildPrompt({ style, color }) {
  const palette = STYLES[style] || STYLES.rose;
  const parts = [
    "elegant wedding poster background, ultra-detailed, romantic atmosphere, professional photography composition,",
    `color palette: ${palette}, ${color || ""},`,
    "soft bokeh background, floral decoration, gold foil details,",
    "IMPORTANT: leave the bottom 40% of the image clean and uncluttered for text overlay (no faces, no important details there),",
    "do NOT render any text or letters or chinese characters in the image,",
    "high-quality detailed background, balanced symmetrical composition",
  ];
  return parts.filter(Boolean).join(" ");
}

const NEGATIVE = "text, letters, words, chinese characters, watermark, signature, logo, low quality, blurry, ugly, distorted, extra limbs, poor anatomy, busy bottom area, cluttered foreground";

// ---------- POST: 创建任务 ----------
async function createTask({ request, env }) {
  const ip = getIp(request);
  if (!rateLimit(ip, 5)) return json(429, { ok: false, error: "请稍后再试（每分钟 5 次）" });
  const key = env.DASHSCOPE_API_KEY;
  if (!key) return json(503, { ok: false, error: "AI 海报服务未配置（缺少 DASHSCOPE_API_KEY）" });

  const { data: body, err } = await readJsonBody(request, 8192);
  if (err === "payload_too_large") return json(413, { ok: false, error: "请求内容过大" });
  if (err) return badRequest("invalid json");

  // 校验通过后扣除每日配额
  const allowed = await checkDailyQuota(env, ip, "poster", 10, 200);
  if (!allowed) return json(429, { ok: false, error: "今日免费 AI 海报配额已用完，请明天再试" });

  const size = SIZES[body?.size] || SIZES.portrait;
  const style = Object.hasOwn(STYLES, body?.style) ? body.style : "rose";
  const color = String(body?.color || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const prompt = buildPrompt({ style, color });

  const r = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: MODEL,
        input: { prompt, negative_prompt: NEGATIVE },
        parameters: { size, n: 1, prompt_extend: true },
      }),
    }
  );
  const data = await r.json();
  if (!r.ok) return serverError(data?.message || "创建任务失败");
  const taskId = data?.output?.task_id;
  if (!taskId) return serverError("未拿到 task_id");
  return json(200, { ok: true, taskId });
}

// ---------- GET: 查询任务 ----------
async function queryTask({ request, env }) {
  const key = env.DASHSCOPE_API_KEY;
  if (!key) return json(503, { ok: false, error: "未配置" });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !/^[a-f0-9-]{6,64}$/i.test(id)) return badRequest("invalid id");

  const r = await fetch(
    `https://dashscope.aliyuncs.com/api/v1/tasks/${encodeURIComponent(id)}`,
    {
      headers: { authorization: `Bearer ${key}` },
    }
  );
  const data = await r.json();
  if (!r.ok) return serverError(data?.message || "查询失败");

  const status = data?.output?.task_status; // PENDING / RUNNING / SUCCEEDED / FAILED
  if (status === "SUCCEEDED") {
    const rawUrl = data?.output?.results?.[0]?.url;
    if (!rawUrl) return serverError("未返回图片地址");
    // 返回代理地址，避免把阿里云带签名的临时 URL 暴露或让客户端直接下载跨域
    const proxyUrl = `/api/poster-img?u=${encodeURIComponent(rawUrl)}`;
    return json(200, { ok: true, status: "SUCCEEDED", imageUrl: proxyUrl });
  }
  if (status === "FAILED") {
    return json(200, { ok: true, status: "FAILED", error: data?.output?.message || "生成失败" });
  }
  return json(200, { ok: true, status: status || "RUNNING" });
}

export const onRequestPost = createTask;
export const onRequestGet = queryTask;
