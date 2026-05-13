// GET /api/load?id=xxx -> { ok, invitation }
import { json, badRequest, serverError } from "../_lib.js";

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
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
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (e) {
    return serverError(String(e?.message || e));
  }
};
