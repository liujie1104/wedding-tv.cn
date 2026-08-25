// GET /api/load?id=xxx -> { ok, invitation }
import { json, badRequest, serverError } from "../_lib.js";

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);

  // 1. 婚礼大屏弹幕轮询
  const wallRoom = url.searchParams.get("wall");
  if (wallRoom) {
    const room = wallRoom.slice(0, 32);
    const since = Number(url.searchParams.get("since") || 0);
    let list = [];
    if (env.WEDDING) {
      try {
        const raw = await env.WEDDING.get("wall:" + room);
        if (raw) list = JSON.parse(raw);
      } catch {}
    }
    const newItems = list.filter(item => item.ts > since);
    return json(200, { ok: true, messages: newItems, total: list.length });
  }

  const id = url.searchParams.get("id");
  if (!id || !/^[a-z0-9]{4,16}$/i.test(id)) return badRequest("bad id");
  if (!env.WEDDING) return serverError("KV not configured");
  try {
    const inv = await env.WEDDING.get("inv:" + id, "json");
    if (!inv) return json(404, { ok: false, error: "not found" });
    return new Response(JSON.stringify({ ok: true, invitation: inv }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
