// AI 婚礼海报生成 - 基于阿里云百炼万相 wanx2.1-t2i-turbo
// POST /api/poster        body: { groom, bride, date, venue, style, color, size }  -> { ok, taskId }
// GET  /api/poster?id=xxx                                                          -> { ok, status, imageUrl?, error? }
import { json, badRequest, serverError, rateLimit, getIp } from "../_lib.js";

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

function buildPrompt({ groom, bride, date, venue, style, color }) {
  const palette = STYLES[style] || STYLES.rose;
  const names = [groom, bride].filter(Boolean).join(" & ");
  const parts = [
    "elegant wedding poster, ultra-detailed, romantic atmosphere, professional photography composition,",
    `color palette: ${palette}, ${color || ""},`,
    "soft bokeh background, floral decoration, delicate gold foil typography area,",
    names ? `with elegant calligraphy text area for couple names "${names}"` : "with empty calligraphy text area for couple names",
    date ? `and wedding date "${date}"` : "",
    venue ? `, venue: ${venue}` : "",
    ", high resolution, 8k, masterpiece, award-winning design, symmetrical composition,",
    "clean center area for text overlay (do NOT render Chinese characters)",
  ];
  return parts.filter(Boolean).join(" ");
}

const NEGATIVE = "low quality, blurry, watermark, text artifacts, garbled text, ugly, distorted, extra limbs, signature, chinese characters wrong, poor anatomy";

// ---------- POST: 创建任务 ----------
async function createTask({ request, env }) {
  if (!rateLimit(getIp(request), 5)) return json(429, { ok: false, error: "请稍后再试（每分钟 5 次）" });
  const key = env.DASHSCOPE_API_KEY;
  if (!key) return json(503, { ok: false, error: "AI 海报服务未配置（缺少 DASHSCOPE_API_KEY）" });

  let body;
  try { body = await request.json(); } catch { return badRequest("invalid json"); }

  const size = SIZES[body?.size] || SIZES.portrait;
  const prompt = buildPrompt(body || {});

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

  const r = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${id}`, {
    headers: { authorization: `Bearer ${key}` },
  });
  const data = await r.json();
  if (!r.ok) return serverError(data?.message || "查询失败");

  const status = data?.output?.task_status;
  // PENDING / RUNNING / SUCCEEDED / FAILED / CANCELED
  if (status === "SUCCEEDED") {
    const imageUrl = data?.output?.results?.[0]?.url;
    return json(200, { ok: true, status, imageUrl });
  }
  if (status === "FAILED" || status === "CANCELED") {
    return json(200, { ok: true, status, error: data?.output?.message || data?.output?.code || "生成失败" });
  }
  return json(200, { ok: true, status: status || "RUNNING" });
}

export const onRequestPost = createTask;
export const onRequestGet  = queryTask;
