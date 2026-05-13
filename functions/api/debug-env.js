// GET /api/debug-env -> 诊断环境变量与 KV 绑定
import { json } from "../_lib.js";

export const onRequestGet = async ({ env }) => {
  const k = env.GEMINI_API_KEY || "";
  return json(200, {
    GEMINI_API_KEY: {
      present: !!k,
      length: k.length,
      head: k.slice(0, 4),
      tail: k.slice(-4),
      hasWhitespace: k !== k.trim(),
    },
    AVATAR_ENABLED: env.AVATAR_ENABLED || "",
    AVATAR_DAILY_LIMIT: env.AVATAR_DAILY_LIMIT || "",
    KV_BOUND: !!env.WEDDING,
    runtime: "cloudflare-pages",
  });
};
