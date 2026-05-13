// GET /api/debug-env
// 仅返回环境变量元信息（长度、前 4 后 4），不返回完整 key
import { json } from "./_lib.js";

export default async () => {
  const k = process.env.GEMINI_API_KEY || "";
  const a = process.env.AVATAR_ENABLED || "";
  const l = process.env.AVATAR_DAILY_LIMIT || "";
  return json(200, {
    GEMINI_API_KEY: {
      present: !!k,
      length: k.length,
      head: k.slice(0, 4),
      tail: k.slice(-4),
      hasWhitespace: k !== k.trim(),
    },
    AVATAR_ENABLED: a,
    AVATAR_DAILY_LIMIT: l,
    nodeVersion: process.version,
    siteId: process.env.SITE_ID || null,
    deployId: process.env.DEPLOY_ID || null,
  });
};

export const config = { path: "/api/debug-env" };
