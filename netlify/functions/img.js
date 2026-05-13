// GET /api/img?key=xxx
// 直接以二进制流回返图片
import { getStore } from "@netlify/blobs";
import { badRequest } from "./_lib.js";

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key || !/^[a-z0-9]{4,16}\.(jpg|png|webp)$/i.test(key)) return badRequest("bad key");
  const store = getStore("invitation-images");
  const meta = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!meta) return new Response("not found", { status: 404 });
  const mime = meta.metadata?.mime || "image/jpeg";
  return new Response(meta.data, {
    status: 200,
    headers: {
      "content-type": mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/api/img" };
