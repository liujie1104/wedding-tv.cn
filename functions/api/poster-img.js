// GET /api/poster-img?url=<encoded oss url>
// 代理 dashscope OSS 图片，解决 CORS / 下载文件名问题
import { badRequest } from "../_lib.js";

const ALLOW_HOSTS = [
  "dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com",
  "dashscope-result-bj.oss-cn-beijing.aliyuncs.com",
  "dashscope-result-sh.oss-cn-shanghai.aliyuncs.com",
  "dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com",
];

export const onRequestGet = async ({ request }) => {
  const url = new URL(request.url);
  const target = url.searchParams.get("url") || url.searchParams.get("u");
  if (!target) return badRequest("missing url");
  let u;
  try { u = new URL(target); } catch { return badRequest("invalid url"); }
  if (u.protocol !== "https:") return badRequest("https only");
  // 仅允许 dashscope 的 oss 子域，避免被滥用为开放代理
  const okHost = u.hostname.startsWith("dashscope-result-") && u.hostname.endsWith(".aliyuncs.com");
  if (!okHost && !ALLOW_HOSTS.includes(u.hostname)) return badRequest("host not allowed");

  const r = await fetch(u.toString(), { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) return new Response("upstream error", { status: 502 });

  const contentType = (r.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
  if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    return new Response("upstream did not return a supported image", { status: 502 });
  }

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", "public, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  // 用作下载文件名
  const requestedName = url.searchParams.get("name") || `wedding-poster-${Date.now()}.png`;
  const filename = requestedName.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80) || "wedding-poster.png";
  if (url.searchParams.get("dl") === "1") {
    headers.set("content-disposition", `attachment; filename="${filename}"`);
  }
  return new Response(r.body, { status: 200, headers });
};
