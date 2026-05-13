// GET /api/img?key=xxx -> 二进制图片
import { badRequest } from "../_lib.js";

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !/^[a-z0-9]{4,16}\.(jpg|png|webp)$/i.test(key)) return badRequest("bad key");
  if (!env.WEDDING) return new Response("KV not configured", { status: 500 });
  const { value, metadata } = await env.WEDDING.getWithMetadata("img:" + key, "arrayBuffer");
  if (!value) return new Response("not found", { status: 404 });
  const mime = metadata?.mime || "image/jpeg";
  return new Response(value, {
    status: 200,
    headers: {
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
