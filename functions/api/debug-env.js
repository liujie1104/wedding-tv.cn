// GET /api/debug-env -> 诊断环境变量与 KV 绑定
import { json } from "../_lib.js";

const probe = (k) => ({
  present: !!k,
  length: k?.length || 0,
  head: (k || "").slice(0, 4),
  tail: (k || "").slice(-4),
  hasWhitespace: !!k && k !== k.trim(),
});

export const onRequestGet = async ({ env }) => {
  return json(200, {
    GEMINI_API_KEY: probe(env.GEMINI_API_KEY || ""),
    DASHSCOPE_API_KEY: probe(env.DASHSCOPE_API_KEY || ""),
    BAILIAN_BASE_URL: env.BAILIAN_BASE_URL || "",
    BAILIAN_MODEL: env.BAILIAN_MODEL || "",
    AVATAR_ENABLED: env.AVATAR_ENABLED || "",
    AVATAR_DAILY_LIMIT: env.AVATAR_DAILY_LIMIT || "",
    KV_BOUND: !!env.WEDDING,
    runtime: "cloudflare-pages",
  });
};
