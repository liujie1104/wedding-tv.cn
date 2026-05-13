// GET /api/load?id=xxx
// 返回 { ok, invitation }
import { getStore } from "@netlify/blobs";
import { json, badRequest, serverError } from "./_lib.js";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !/^[a-z0-9]{4,16}$/i.test(id)) return badRequest("bad id");
  try {
    const store = getStore("invitations");
    const inv = await store.get(id, { type: "json" });
    if (!inv) return json(404, { ok: false, error: "not found" });
    return new Response(JSON.stringify({ ok: true, invitation: inv }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // 请帖内容很少改，缓存 5 分钟（CDN 边缘）
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};

export const config = { path: "/api/load" };
