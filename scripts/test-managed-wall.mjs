import test from "node:test";
import assert from "node:assert/strict";
import { managedFetch, managedAlarm, keyHash, MESSAGE_TTL, ROOM_TTL, MESSAGE_LIMIT, normalizeSettings } from "../src/managed-wall.js";

// Serialized, clone-on-read storage models the transaction boundary; browser tests
// separately exercise Cloudflare's actual local Durable Object implementation.
class Storage {
  data = new Map(); alarm = null; tail = Promise.resolve();
  async get(k) { return structuredClone(this.data.get(k)); }
  async put(k, v) { this.data.set(k, structuredClone(v)); }
  async list({ prefix = "" } = {}) { return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async delete(k) {
    if (Array.isArray(k)) { assert.ok(k.length <= 128); k.forEach(key => this.data.delete(key)); }
    else this.data.delete(k);
  }
  async deleteAll() { this.data.clear(); this.alarm = null; }
  async getAlarm() { return this.alarm; }
  async setAlarm(value) { this.alarm = value; }
  async deleteAlarm() { this.alarm = null; }
  transaction(fn) { const result = this.tail.then(() => fn(this)); this.tail = result.catch(() => {}); return result; }
}
const key = "a".repeat(64);
async function call(state, action, body, token = "") {
  const response = await managedFetch(state, new Request("https://wall-room/managed/" + action, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: token ? "Bearer " + token : "", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  return { status: response.status, data: await response.json() };
}
async function room() {
  const state = { storage: new Storage() };
  const created = await call(state, "create", { settings: { groom: "A", bride: "B" }, keyHash: await keyHash(key) });
  assert.equal(created.status, 201);
  assert.equal(created.data.room.mode, "trial");
  assert.ok(created.data.room.expiresAt > Date.now() + ROOM_TTL - 1000);
  return state;
}
function message(extra = {}) { return { id: crypto.randomUUID(), name: "Guest", message: "Best wishes", ...extra }; }

test("managed wall: pending content and secrets are private; approval is authorized and idempotent", async () => {
  const state = await room(), item = message({ message: "<img src=x onerror=alert(1)>" });
  assert.equal((await call(state, "submit", item)).status, 200);
  const publicData = (await call(state, "public")).data;
  assert.equal(publicData.messages.length, 0);
  assert.equal(publicData.stats, undefined);
  assert.equal(publicData.room.keyHash, undefined);
  assert.equal((await call(state, "admin")).status, 403);
  assert.equal((await call(state, "approve", { id: item.id }, "wrong")).status, 403);
  assert.equal((await call(state, "admin", undefined, key)).data.messages.length, 1);
  await call(state, "approve", { id: item.id }, key);
  await call(state, "approve", { id: item.id }, key);
  assert.equal((await call(state, "public")).data.messages[0].message, item.message);
  assert.equal((await call(state, "admin", undefined, key)).data.stats.approved, 1);
});

test("managed wall: retries and parallel submissions do not overwrite or duplicate messages", async () => {
  const state = await room(), first = message();
  await Promise.all(Array.from({ length: 8 }, () => call(state, "submit", first)));
  await Promise.all(Array.from({ length: 12 }, () => call(state, "submit", message())));
  assert.equal((await call(state, "admin", undefined, key)).data.stats.submitted, 13);
  await call(state, "delete", { id: first.id }, key);
  await call(state, "submit", first);
  const admin = (await call(state, "admin", undefined, key)).data;
  assert.equal(admin.messages.length, 12);
  assert.equal(admin.stats.submitted, 13);
});

test("managed wall: pause receiving, settings validation and capacity never silently evict content", async () => {
  const state = await room();
  await call(state, "settings", { accepting: false, paused: true }, key);
  assert.equal((await call(state, "submit", message())).status, 409);
  assert.equal((await call(state, "public")).data.room.paused, true);
  assert.equal((await call(state, "settings", { settings: { groom: "" } }, key)).status, 400);
  assert.equal(normalizeSettings(null).groom, "");
  const meta = await state.storage.get("managed");
  meta.accepting = true; meta.submitted = MESSAGE_LIMIT - 1; await state.storage.put("managed", meta);
  const item = message();
  assert.equal((await call(state, "submit", item)).status, 200);
  assert.equal((await call(state, "submit", message())).status, 409);
  assert.equal((await call(state, "admin", undefined, key)).data.messages[0].id, item.id);
});

test("managed wall: 24-hour content expiry, room expiry, and full deletion", async () => {
  const state = await room(), item = message();
  await call(state, "submit", item);
  const entry = await state.storage.get("entry:" + item.id);
  entry.ts = Date.now() - MESSAGE_TTL; await state.storage.put("entry:" + item.id, entry);
  assert.equal((await call(state, "admin", undefined, key)).data.messages.length, 0);
  assert.equal((await call(state, "approve", { id: item.id }, key)).status, 404);
  await managedAlarm(state);
  assert.equal(await state.storage.get("entry:" + item.id), undefined);
  assert.equal(await state.storage.get("receipt:" + item.id), true);
  for (let i = 0; i < 1000; i++) await state.storage.put("receipt:" + i, true);
  assert.equal((await call(state, "close", {}, "wrong")).status, 403);
  assert.equal((await call(state, "close", {}, key)).status, 200);
  assert.equal(state.storage.data.size, 0);
  assert.equal((await call(state, "public")).status, 410);
  assert.equal(await managedAlarm(state), false);
  const expired = await room(), meta = await expired.storage.get("managed");
  meta.expiresAt = Date.now() - 1; await expired.storage.put("managed", meta);
  assert.equal((await call(expired, "public")).status, 410);
  await managedAlarm(expired); assert.equal(expired.storage.data.size, 0);
});
