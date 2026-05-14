import { json, badRequest, getIp, rateLimit } from "../_lib.js";

const ALLOWED = new Set([
  "click_offer",
  "click_blog_top",
  "click_tools_top",
  "click_scene_buyer",
  "click_scene_user",
  "open_blog_region",
  "open_tool",
  "submit_offer",
  "ab_contact_click",
]);

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function incr(kv, key, delta = 1) {
  const cur = Number((await kv.get(key)) || "0") || 0;
  const next = cur + delta;
  await kv.put(key, String(next));
  return next;
}

export async function onRequestPost({ request, env }) {
  if (!env.WEDDING) return json(503, { ok: false, error: "kv not bound" });
  if (!rateLimit(getIp(request), 120, 60_000)) return json(429, { ok: false, error: "too many requests" });

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid json");
  }

  const event = String(body?.event || "").trim();
  if (!ALLOWED.has(event)) return badRequest("invalid event");

  const page = String(body?.page || "").slice(0, 120);
  const ref = String(body?.ref || "").slice(0, 200);
  const variant = String(body?.variant || "").slice(0, 20);
  const ip = getIp(request);
  const d = dayKey();

  const total = await incr(env.WEDDING, `track:total:${event}`, 1);
  const daily = await incr(env.WEDDING, `track:day:${d}:${event}`, 1);

  const recKey = "track:recent";
  const arr = JSON.parse((await env.WEDDING.get(recKey)) || "[]");
  arr.unshift({
    t: Date.now(),
    event,
    page,
    ref,
    variant,
    ip4: ip.split(".").slice(0, 2).join(".") || "na",
  });
  if (arr.length > 50) arr.length = 50;
  await env.WEDDING.put(recKey, JSON.stringify(arr));

  return json(200, { ok: true, event, total, daily });
}

export async function onRequestGet({ env, request }) {
  if (!env.WEDDING) return json(503, { ok: false, error: "kv not bound" });
  const u = new URL(request.url);
  const scope = u.searchParams.get("scope") || "summary";

  if (scope === "recent") {
    const recent = JSON.parse((await env.WEDDING.get("track:recent")) || "[]");
    return json(200, { ok: true, recent });
  }

  const d = dayKey();
  const events = Array.from(ALLOWED);
  const totals = {};
  const daily = {};

  for (const e of events) {
    totals[e] = Number((await env.WEDDING.get(`track:total:${e}`)) || "0") || 0;
    daily[e] = Number((await env.WEDDING.get(`track:day:${d}:${e}`)) || "0") || 0;
  }

  return json(200, { ok: true, day: d, totals, daily });
}
