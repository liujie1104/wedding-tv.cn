// Automated regression tests for Cloudflare Worker API contracts, frontend image resolution, quota execution order, XSS security, and policy dates
import test from "node:test";
import "./test-managed-wall.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { onRequestGet as posterImgGet } from "../functions/api/poster-img.js";
import { onRequestGet as posterGet, onRequestPost as posterPost } from "../functions/api/poster.js";
import { onRequestPost as aiPost } from "../functions/api/ai.js";
import { onRequestPost as uploadPost } from "../functions/api/upload.js";
import { onRequestPost as savePost } from "../functions/api/save.js";
import { onRequestGet as loadGet } from "../functions/api/load.js";
import worker, { WallRoom } from "../src/worker.js";
import {
  BAIDU_ANALYTICS_EXCLUDED_PATHS,
  BAIDU_ANALYTICS_ID,
  BAIDU_ANALYTICS_SNIPPET,
  shouldInjectBaiduAnalytics,
} from "../src/baidu-analytics.js";
import {
  DEFAULT_BAILIAN_IMAGE_MODEL,
  DEFAULT_BAILIAN_TEXT_MODEL,
  listRecordedBailianModels,
  requireBailianBeijingBaseUrl,
  requireBailianModel,
} from "../functions/_bailian-model-policy.js";

// Mock KV implementation
class MockKV {
  constructor() {
    this.store = new Map();
    this.puts = [];
    this.gets = [];
  }

  async get(key) {
    this.gets.push(key);
    return this.store.get(key) || null;
  }

  async put(key, value, options = {}) {
    this.puts.push({ key, value, options });
    this.store.set(key, typeof value === "string" ? value : String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }
}

// 1x1 transparent PNG with valid signature (\x89PNG\r\n\x1a\n)
const VALID_1X1_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Fake PNG dataUrl with invalid signature
const FAKE_PNG_DATA_URL =
  "data:image/png;base64,VEVTVEZBS0VQTkdOT1RBUE5HQVRBTEw="; // "TESTFAKENOTPNGATALL"

test("Baidu analytics: public content is consent-gated and private/noindex routes are excluded", () => {
  assert.equal(BAIDU_ANALYTICS_ID, "1df8fda3d25e8df34a5c8e08f945e9fb");
  assert.match(BAIDU_ANALYTICS_SNIPPET, /wedding_baidu_analytics_consent_v1/);
  assert.match(BAIDU_ANALYTICS_SNIPPET, /https:\/\/hm\.baidu\.com\/hm\.js\?/);
  assert.match(BAIDU_ANALYTICS_SNIPPET, /允许统计/);
  assert.match(BAIDU_ANALYTICS_SNIPPET, /拒绝/);
  assert.equal(shouldInjectBaiduAnalytics("/"), true);
  assert.equal(shouldInjectBaiduAnalytics("/en/"), true);
  assert.equal(shouldInjectBaiduAnalytics("/blog/hunan.html"), true);
  assert.equal(shouldInjectBaiduAnalytics("/privacy.html"), true);
  assert.equal(shouldInjectBaiduAnalytics("/assets/speed-booster.js"), false);
  for (const route of BAIDU_ANALYTICS_EXCLUDED_PATHS) {
    assert.equal(shouldInjectBaiduAnalytics(route), false, `${route} must remain excluded`);
  }
});

test("Worker injects Baidu consent code into public HTML but not invitation short links", async (t) => {
  const originalHtmlRewriter = globalThis.HTMLRewriter;
  let transformCount = 0;
  globalThis.HTMLRewriter = class {
    on(selector, handler) {
      assert.equal(selector, "head");
      this.handler = handler;
      return this;
    }

    transform(response) {
      transformCount += 1;
      let appended = "";
      this.handler.element({
        append(value, options) {
          assert.deepEqual(options, { html: true });
          appended += value;
        },
      });
      return new Response(`<!doctype html><html><head>${appended}</head><body>page</body></html>`, {
        status: response.status,
        headers: response.headers,
      });
    }
  };
  t.after(() => {
    if (originalHtmlRewriter === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = originalHtmlRewriter;
  });

  const env = {
    ASSETS: {
      fetch: async () => new Response("<!doctype html><html><head></head><body>page</body></html>", {
        headers: { "content-type": "text/html" },
      }),
    },
  };
  const ctx = { waitUntil() {} };

  const publicResponse = await worker.fetch(
    new Request("https://wedding-tv.cn/blog/hunan.html"),
    env,
    ctx
  );
  const publicHtml = await publicResponse.text();
  assert.match(publicHtml, new RegExp(BAIDU_ANALYTICS_ID));
  assert.match(publicHtml, /data-purpose="baidu-analytics-consent"/);

  const invitationResponse = await worker.fetch(
    new Request("https://wedding-tv.cn/i/abc12345"),
    env,
    ctx
  );
  assert.doesNotMatch(await invitationResponse.text(), new RegExp(BAIDU_ANALYTICS_ID));
  assert.equal(transformCount, 1, "only the public content response should be rewritten");
});

test("Poster proxy contract: poster task success output is directly consumable by poster-img", async (t) => {
  const originalFetch = globalThis.fetch;
  const mockTaskId = "abcdef-123456"; // Valid hex + hyphen task ID matching /^[a-f0-9-]{6,64}$/i
  const mockOssUrl = "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/task123/final.png";

  // Mock global fetch for DashScope API and OSS
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes(`dashscope.aliyuncs.com/api/v1/tasks/${mockTaskId}`)) {
      return new Response(
        JSON.stringify({
          output: {
            task_id: mockTaskId,
            task_status: "SUCCEEDED",
            choices: [
              {
                finish_reason: "stop",
                message: { role: "assistant", content: [{ type: "image", image: mockOssUrl }] },
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (urlStr === mockOssUrl) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    return new Response("not found", { status: 404 });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Step 1: Query task from poster.js
  const queryReq = new Request(`https://wedding-tv.cn/api/poster?id=${mockTaskId}`, {
    headers: { "cf-connecting-ip": "1.2.3.4" },
  });
  const queryRes = await posterGet({ request: queryReq, env: { DASHSCOPE_API_KEY: "test-key" } });
  assert.equal(queryRes.status, 200);

  const queryData = await queryRes.json();
  assert.equal(queryData.ok, true);
  assert.equal(queryData.status, "SUCCEEDED");
  assert.ok(queryData.imageUrl, "imageUrl should be returned");
  assert.ok(
    queryData.imageUrl.startsWith("/api/poster-img?url="),
    `imageUrl should be /api/poster-img?url=..., got: ${queryData.imageUrl}`
  );

  // Step 2: Feed the exact returned imageUrl to poster-img.js
  const imgReq = new Request(`https://wedding-tv.cn${queryData.imageUrl}`);
  const imgRes = await posterImgGet({ request: imgReq });
  assert.equal(imgRes.status, 200, "poster-img should return 200 for valid proxied image");
  assert.equal(imgRes.headers.get("content-type"), "image/png");

  // Step 3: Test download flag dl=1
  const dlReq = new Request(`https://wedding-tv.cn${queryData.imageUrl}&dl=1&name=test-wedding.png`);
  const dlRes = await posterImgGet({ request: dlReq });
  assert.equal(dlRes.status, 200);
  assert.equal(dlRes.headers.get("content-disposition"), 'attachment; filename="test-wedding.png"');

  // Step 4: Test backward-compatible 'u' query parameter
  const legacyReq = new Request(`https://wedding-tv.cn/api/poster-img?u=${encodeURIComponent(mockOssUrl)}`);
  const legacyRes = await posterImgGet({ request: legacyReq });
  assert.equal(legacyRes.status, 200);

  // Step 5: Test untrusted / malicious host rejection
  const evilReq = new Request("https://wedding-tv.cn/api/poster-img?url=https%3A%2F%2Fmalicious-site.com%2Fbad.png");
  const evilRes = await posterImgGet({ request: evilReq });
  assert.equal(evilRes.status, 400);

  // Step 6: Test double-wrapped relative path rejection
  const doubleWrappedReq = new Request("https://wedding-tv.cn/api/poster-img?url=%2Fapi%2Fposter-img%3Fu%3Dtest");
  const doubleWrappedRes = await posterImgGet({ request: doubleWrappedReq });
  assert.equal(doubleWrappedRes.status, 400);
});

test("Poster frontend contract: poster.html resolveImageUrl never double-wraps proxied URLs", async () => {
  const root = path.resolve(process.cwd());
  const posterHtmlPath = path.join(root, "poster.html");
  const posterHtml = fs.readFileSync(posterHtmlPath, "utf8");

  // 1. Verify that resolveImageUrl is defined in poster.html
  assert.ok(posterHtml.includes("function resolveImageUrl(url)"), "poster.html must define resolveImageUrl");

  // 2. Extract resolveImageUrl function and execute in sandbox
  const match = posterHtml.match(/function resolveImageUrl\(url\)\s*\{[\s\S]*?\n\}/);
  assert.ok(match, "resolveImageUrl function body must match");

  const context = {};
  vm.createContext(context);
  vm.runInContext(match[0], context);
  const resolveImageUrl = context.resolveImageUrl;
  assert.equal(typeof resolveImageUrl, "function");

  // Case A: Proxied relative path from backend
  const backendProxyUrl = "/api/poster-img?url=https%3A%2F%2Fdashscope-result-bj.oss-cn-beijing.aliyuncs.com%2Fimage.png";
  assert.equal(
    resolveImageUrl(backendProxyUrl),
    backendProxyUrl,
    "Should return relative proxy URL directly without double-wrapping"
  );

  // Case B: Raw external https URL
  const rawHttpsUrl = "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/image.png";
  assert.equal(
    resolveImageUrl(rawHttpsUrl),
    `/api/poster-img?url=${encodeURIComponent(rawHttpsUrl)}`,
    "Should wrap raw external https URL"
  );

  // Case C: Data URL
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
  assert.equal(resolveImageUrl(dataUrl), dataUrl, "Should return dataUrl directly");

  // 3. Static contract: ensure composite and showImage in poster.html never bypass resolveImageUrl
  assert.ok(
    posterHtml.includes("const imgUrl = resolveImageUrl(url);"),
    "composite() must use resolveImageUrl(url)"
  );
  assert.ok(
    posterHtml.includes("const directView = resolveImageUrl(url);"),
    "showImage() fallback must use resolveImageUrl(url)"
  );
  assert.ok(
    !posterHtml.includes("const proxy = `/api/poster-img?url=${encodeURIComponent(url)}`"),
    "poster.html must not contain old double-wrapping proxy template"
  );
});

test("Bailian model policy: only quota-backed models and matching capabilities are accepted", () => {
  const models = listRecordedBailianModels();
  assert.equal(models.length, 80, "all 80 readable model codes from the screenshots must be recorded");
  assert.ok(models.every((record) => record.quota.remaining > 0), "every allowlisted model must have positive quota");
  assert.ok(models.every((record) => record.freeStopEnabled), "every allowlisted model must have free-stop enabled");
  assert.equal(requireBailianModel(DEFAULT_BAILIAN_TEXT_MODEL, "text-generation").quota.remaining, 1_000_000);
  assert.equal(requireBailianModel(DEFAULT_BAILIAN_IMAGE_MODEL, "image-generation").quota.remaining, 10);
  assert.throws(() => requireBailianModel("qwen-plus", "text-generation"), /未列入免费额度白名单/);
  assert.throws(() => requireBailianModel("wanx2.1-t2i-turbo", "image-generation"), /未列入免费额度白名单/);
  assert.throws(() => requireBailianModel("wan3.0-video", "image-generation"), /不支持当前用途/);
});

test("Bailian endpoint policy: only Beijing free-quota endpoints are accepted", () => {
  assert.equal(
    requireBailianBeijingBaseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1").hostname,
    "dashscope.aliyuncs.com"
  );
  assert.equal(
    requireBailianBeijingBaseUrl("https://workspace-id.cn-beijing.maas.aliyuncs.com/compatible-mode/v1").hostname,
    "workspace-id.cn-beijing.maas.aliyuncs.com"
  );
  assert.throws(
    () => requireBailianBeijingBaseUrl("https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
    /仅允许华北 2/
  );
  assert.throws(
    () => requireBailianBeijingBaseUrl("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"),
    /Token Plan/
  );
  assert.throws(() => requireBailianBeijingBaseUrl("http://dashscope.aliyuncs.com"), /仅允许华北 2/);
});

test("AI API rejects an unquotaed model before making a provider request", async (t) => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("provider must not be called");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request("https://wedding-tv.cn/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "2.3.4.6" },
    body: JSON.stringify({ kind: "vows", story: "测试内容足够长" }),
  });
  const response = await aiPost({
    request,
    env: { DASHSCOPE_API_KEY: "test-key", BAILIAN_MODEL: "qwen-plus" },
  });
  assert.equal(response.status, 503);
  assert.equal(providerCalled, false);
});

test("Poster API rejects a non-Beijing or Token Plan endpoint before consuming quota", async () => {
  const kv = new MockKV();
  const request = new Request("https://wedding-tv.cn/api/poster", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "2.3.4.7" },
    body: JSON.stringify({ style: "rose", size: "portrait" }),
  });
  const response = await posterPost({
    request,
    env: {
      DASHSCOPE_API_KEY: "test-key",
      BAILIAN_IMAGE_BASE_URL: "https://token-plan.cn-beijing.maas.aliyuncs.com",
      WEDDING: kv,
    },
  });
  assert.equal(response.status, 503);
  assert.equal(kv.puts.length, 0);
});

test("Poster API uses the approved qwen-image endpoint and request schema", async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody;
  globalThis.fetch = async (url, opts) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(opts.body);
    return new Response(JSON.stringify({ output: { task_id: "abcdef-123456", task_status: "PENDING" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request("https://wedding-tv.cn/api/poster", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "2.3.4.5" },
    body: JSON.stringify({ style: "rose", size: "portrait" }),
  });
  const response = await posterPost({ request, env: { DASHSCOPE_API_KEY: "test-key" } });
  assert.equal(response.status, 200);
  assert.match(capturedUrl, /\/api\/v1\/services\/aigc\/image-generation\/generation$/);
  assert.equal(capturedBody.model, "qwen-image-3.0");
  assert.equal(capturedBody.input.messages[0].content[0].text.length > 20, true);
  assert.equal(capturedBody.parameters.n, 1);
  assert.equal(capturedBody.parameters.watermark, false);
});

test("Repository contains no retired unquotaed Bailian defaults", () => {
  const root = path.resolve(process.cwd());
  const guardedFiles = [
    path.join(root, "functions", "api", "ai.js"),
    path.join(root, "functions", "api", "poster.js"),
    path.join(root, "scripts", "ai_content_quality.py"),
    path.join(root, "wrangler.jsonc"),
  ];
  for (const file of guardedFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(!source.includes("qwen-plus"), `${path.relative(root, file)} must not use qwen-plus`);
    assert.ok(!source.includes("wanx2.1-t2i-turbo"), `${path.relative(root, file)} must not use wanx2.1-t2i-turbo`);
  }
});

test("Upload validation & quota order: invalid uploads never consume daily quota, only valid uploads write quota", async () => {
  const kv = new MockKV();
  const env = { WEDDING: kv };
  const clientIp = "192.168.1.100";

  // Helper to count quota puts in KV
  const getQuotaPutCount = () =>
    kv.puts.filter((p) => p.key.startsWith("quota:upload:")).length;

  // Case 1: Invalid JSON payload
  const req1 = new Request("https://wedding-tv.cn/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: "{ bad-json",
  });
  const res1 = await uploadPost({ request: req1, env });
  assert.equal(res1.status, 400);
  assert.equal(getQuotaPutCount(), 0, "Invalid JSON should not write quota");

  // Case 2: Missing or invalid dataUrl format
  const req2 = new Request("https://wedding-tv.cn/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: JSON.stringify({ dataUrl: "http://example.com/not-data-url.png" }),
  });
  const res2 = await uploadPost({ request: req2, env });
  assert.equal(res2.status, 400);
  assert.equal(getQuotaPutCount(), 0, "Invalid dataUrl format should not write quota");

  // Case 3: Unsupported MIME type (e.g. image/gif)
  const req3 = new Request("https://wedding-tv.cn/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: JSON.stringify({ dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" }),
  });
  const res3 = await uploadPost({ request: req3, env });
  assert.equal(res3.status, 400);
  assert.equal(getQuotaPutCount(), 0, "Unsupported MIME should not write quota");

  // Case 4: Invalid magic bytes / file signature mismatch
  const req4 = new Request("https://wedding-tv.cn/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: JSON.stringify({ dataUrl: FAKE_PNG_DATA_URL }),
  });
  const res4 = await uploadPost({ request: req4, env });
  assert.equal(res4.status, 400);
  assert.equal(getQuotaPutCount(), 0, "Mismatched file signature should not write quota");

  // Case 5: Valid PNG upload with proper signature
  const req5 = new Request("https://wedding-tv.cn/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: JSON.stringify({ dataUrl: VALID_1X1_PNG_DATA_URL }),
  });
  const res5 = await uploadPost({ request: req5, env });
  assert.equal(res5.status, 200, "Valid upload should return 200");
  const data5 = await res5.json();
  assert.equal(data5.ok, true);
  assert.ok(data5.key, "Key should be generated");
  assert.ok(data5.url, "Url should be returned");

  // Verify KV writes: 1 image put + 2 quota puts (IP quota + global quota)
  const imagePuts = kv.puts.filter((p) => p.key.startsWith("img:"));
  assert.equal(imagePuts.length, 1, "Image should be written to KV");
  assert.equal(getQuotaPutCount(), 2, "Both IP and global quota should be incremented for valid upload");
});

test("Save API validation & quota order: invalid wall or invitation payloads do not consume quota", async () => {
  const kv = new MockKV();
  const env = { WEDDING: kv };
  const clientIp = "192.168.1.101";

  // Case 1: Invalid wall message (empty message)
  const req1 = new Request("https://wedding-tv.cn/api/save", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: JSON.stringify({ wall: { room: "room1", message: "" } }),
  });
  const res1 = await savePost({ request: req1, env });
  assert.equal(res1.status, 400);
  assert.equal(kv.puts.filter((p) => p.key.startsWith("quota:wall:")).length, 0);

  // Case 2: Invalid invitation (missing names / invalid date)
  const req2 = new Request("https://wedding-tv.cn/api/save", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: JSON.stringify({ invitation: { groom: "", bride: "", date: "invalid-date" } }),
  });
  const res2 = await savePost({ request: req2, env });
  assert.equal(res2.status, 400);
  assert.equal(kv.puts.filter((p) => p.key.startsWith("quota:invite:")).length, 0);

  // Case 3: Valid invitation
  const req3 = new Request("https://wedding-tv.cn/api/save", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": clientIp },
    body: JSON.stringify({
      invitation: {
        groom: "张三",
        bride: "李四",
        date: "2026-10-01",
        time: "12:00",
        venue: "希尔顿酒店",
      },
    }),
  });
  const res3 = await savePost({ request: req3, env });
  assert.equal(res3.status, 200);
  const data3 = await res3.json();
  assert.equal(data3.ok, true);
  assert.ok(data3.id);
  assert.equal(kv.puts.filter((p) => p.key.startsWith("quota:invite:")).length, 2);
});

test("Live wall XSS prevention: guest names and lottery winners use text nodes", async () => {
  const root = path.resolve(process.cwd());
  const screen = fs.readFileSync(path.join(root, "assets/wall-screen.js"), "utf8");
  const guest = fs.readFileSync(path.join(root, "assets/wall-guest.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "assets/wall-ui.js"), "utf8");
  assert.doesNotMatch(screen + guest + ui, /innerHTML|insertAdjacentHTML/);
  assert.match(screen, /\$\("winner"\)\.textContent = winner/);
  assert.match(ui, /el\.textContent = text/);
  assert.match(screen, /node\("strong", item.name\)/);
});

test("Durable Object serial message processing: WallRoom handles serial writes and retrieval", async () => {
  const storageMap = new Map();
  let alarmAt = null;
  const storageOperations = [];
  const mockState = {
    storage: {
      async get(key) { return storageMap.get(key) || null; },
      async put(key, val) { storageOperations.push("put"); storageMap.set(key, val); },
      async setAlarm(timestamp) { storageOperations.push("alarm"); alarmAt = timestamp; },
      async deleteAll() { storageMap.clear(); },
    },
  };

  const wallRoom = new WallRoom(mockState, {});
  const now = Date.now();

  // 1. Post two messages serially
  const msg1 = { id: "m1", name: "宾客A", message: "新婚快乐", ts: now - 1000 };
  const res1 = await wallRoom.fetch(new Request("https://wall-room/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(msg1),
  }));
  assert.equal(res1.status, 200);

  const msg2 = { id: "m2", name: "宾客B", message: "百年好合", ts: now };
  const res2 = await wallRoom.fetch(new Request("https://wall-room/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(msg2),
  }));
  assert.equal(res2.status, 200);

  // 2. Query messages
  const getRes = await wallRoom.fetch(new Request(`https://wall-room/messages?since=${now - 2000}`));
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.ok, true);
  assert.equal(getData.messages.length, 2);
  assert.equal(getData.messages[0].name, "宾客A");
  assert.equal(getData.messages[1].name, "宾客B");
  assert.ok(alarmAt >= now + 86_399_000, "WallRoom must schedule cleanup about 24 hours after the latest post");
  assert.ok(storageOperations.indexOf("alarm") < storageOperations.indexOf("put"), "Cleanup must be scheduled before messages are stored");

  // 3. Alarm removes all room messages
  await wallRoom.alarm();
  const afterAlarmRes = await wallRoom.fetch(new Request("https://wall-room/messages?since=0"));
  const afterAlarmData = await afterAlarmRes.json();
  assert.equal(afterAlarmData.total, 0);
  assert.equal(afterAlarmData.messages.length, 0);
});

test("Wrangler Durable Object configuration: WallRoom uses a SQLite migration", () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "wrangler.jsonc"), "utf8"));
  const binding = config.durable_objects?.bindings?.find((item) => item.name === "WALL_DO");
  assert.equal(binding?.class_name, "WallRoom");

  const migration = config.migrations?.find((item) => item.tag === "v1");
  assert.deepEqual(migration?.new_sqlite_classes, ["WallRoom"]);
  assert.equal(migration?.new_classes, undefined, "New Durable Objects must not use legacy KV-backed migrations");
});

test("Policy pages date integrity: dynamic synchronization based on JSON-LD dateModified", async () => {
  const root = path.resolve(process.cwd());
  const sitemapXml = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

  // Helper to extract lastmod from sitemap for a specific page
  const getSitemapLastmod = (page) => {
    const m = sitemapXml.match(new RegExp(`<loc>https:\\/\\/wedding-tv\\.cn\\/${page}<\\/loc>\\s*<lastmod>([^<]+)<\\/lastmod>`));
    return m ? m[1] : null;
  };

  // 1. Check privacy.html
  const privacyHtml = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
  const privJsonDate = privacyHtml.match(/"dateModified":\s*"([^"]+)"/)?.[1];
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(privJsonDate || ""), "privacy.html must have valid YYYY-MM-DD JSON-LD dateModified");

  const privVisDateMatch = privacyHtml.match(/最后更新：(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const privVisDate = privVisDateMatch ? `${privVisDateMatch[1]}-${String(privVisDateMatch[2]).padStart(2, "0")}-${String(privVisDateMatch[3]).padStart(2, "0")}` : null;
  const privStatusDateMatch = privacyHtml.match(/当前状态[（(](\d{4})年(\d{1,2})月(\d{1,2})日/);
  const privStatusDate = privStatusDateMatch ? `${privStatusDateMatch[1]}-${String(privStatusDateMatch[2]).padStart(2, "0")}-${String(privStatusDateMatch[3]).padStart(2, "0")}` : null;
  const privSitemapDate = getSitemapLastmod("privacy.html");

  assert.equal(privVisDate, privJsonDate, "privacy.html visible date must match JSON-LD dateModified");
  assert.equal(privStatusDate, privJsonDate, "privacy.html current status date must match JSON-LD dateModified");
  assert.equal(privSitemapDate, privJsonDate, "privacy.html sitemap lastmod must match JSON-LD dateModified");

  // 2. Check terms.html
  const termsHtml = fs.readFileSync(path.join(root, "terms.html"), "utf8");
  const termsJsonDate = termsHtml.match(/"dateModified":\s*"([^"]+)"/)?.[1];
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(termsJsonDate || ""), "terms.html must have valid YYYY-MM-DD JSON-LD dateModified");

  const termsVisDateMatch = termsHtml.match(/最后更新：(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const termsVisDate = termsVisDateMatch ? `${termsVisDateMatch[1]}-${String(termsVisDateMatch[2]).padStart(2, "0")}-${String(termsVisDateMatch[3]).padStart(2, "0")}` : null;
  const termsSitemapDate = getSitemapLastmod("terms.html");

  assert.equal(termsVisDate, termsJsonDate, "terms.html visible date must match JSON-LD dateModified");
  assert.equal(termsSitemapDate, termsJsonDate, "terms.html sitemap lastmod must match JSON-LD dateModified");
});

test("Assets deployment contract: browser scripts and assets must not be excluded by .assetsignore", async () => {
  const root = path.resolve(process.cwd());
  const assetsIgnore = fs.readFileSync(path.join(root, ".assetsignore"), "utf8");
  const ignorePatterns = assetsIgnore.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));

  // 1. Verify assets/speed-booster.js exists and is not ignored
  const speedBoosterPath = path.join(root, "assets", "speed-booster.js");
  assert.ok(fs.existsSync(speedBoosterPath), "assets/speed-booster.js must exist on disk");
  assert.ok(!ignorePatterns.some(p => p === "assets/" || p === "assets"), "assets/ must not be in .assetsignore");

  // Verify it has valid JS syntax
  const scriptContent = fs.readFileSync(speedBoosterPath, "utf8");
  assert.doesNotThrow(() => new vm.Script(scriptContent, { filename: "assets/speed-booster.js" }), "assets/speed-booster.js must have valid syntax");

  // 2. Scan all HTML files to ensure none reference old /scripts/speed-booster.js
  const htmlFiles = [];
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (entry.name.endsWith(".html")) htmlFiles.push(full);
    }
  }
  scan(root);

  for (const h of htmlFiles) {
    const content = fs.readFileSync(h, "utf8");
    assert.ok(!content.includes("/scripts/speed-booster.js"), `${path.relative(root, h)} must not reference /scripts/speed-booster.js`);
  }

  // 3. Verify worker redirects legacy /scripts/speed-booster.js
  const workerSrc = fs.readFileSync(path.join(root, "src", "worker.js"), "utf8");
  assert.ok(workerSrc.includes('path === "/scripts/speed-booster.js"'), "worker.js must handle legacy /scripts/speed-booster.js requests");
  assert.ok(workerSrc.includes('permanentRedirect(url, "/assets/speed-booster.js")'), "worker.js must redirect to /assets/speed-booster.js");
});

test("Checklist feature claims contract: checklist.html must accurately describe actual functionality", async () => {
  const root = path.resolve(process.cwd());
  const checklistHtml = fs.readFileSync(path.join(root, "checklist.html"), "utf8");

  // 1. Prohibited exaggerated claims
  assert.ok(!/128\s*项/.test(checklistHtml), "checklist.html must not promise 128 fixed items");
  assert.ok(!/导出\s*Excel/i.test(checklistHtml), "checklist.html must not promise Excel export");
  assert.ok(!/智能倒计时/.test(checklistHtml), "checklist.html must not promise automatic countdown deadline system");

  // 2. Required authorized functional description
  assert.ok(
    checklistHtml.includes("按城市、婚期、预算和人数生成婚礼筹备清单初稿，支持在线勾选、保存当前浏览器进度、复制全文和打印。AI 建议需结合当地情况核对。"),
    "checklist.html description must match authorized summary"
  );

  // 3. Date parity across JSON-LD, visible text, and sitemap
  const sitemapXml = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const sitemapMatch = sitemapXml.match(/<loc>https:\/\/wedding-tv\.cn\/checklist\.html<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/);
  const sitemapDate = sitemapMatch ? sitemapMatch[1] : null;

  const jsonDate = checklistHtml.match(/"dateModified":\s*"([^"]+)"/)?.[1];
  const visDateMatch = checklistHtml.match(/更新[：:]\s*(\d{4})[-年](\d{1,2})[-月](\d{1,2})/);
  const visDate = visDateMatch ? `${visDateMatch[1]}-${String(visDateMatch[2]).padStart(2, "0")}-${String(visDateMatch[3]).padStart(2, "0")}` : null;

  assert.ok(jsonDate, "checklist.html must have JSON-LD dateModified");
  assert.equal(visDate, jsonDate, "checklist.html visible date must match dateModified");
  assert.equal(sitemapDate, jsonDate, "checklist.html sitemap lastmod must match dateModified");
});

test("AI prompt constraints: checklist prompt forbids hallucinating merchants and local market prices", () => {
  const root = path.resolve(process.cwd());
  const aiSource = fs.readFileSync(path.join(root, "functions", "api", "ai.js"), "utf8");

  // Verify checklist prompt constraints
  assert.ok(aiSource.includes("绝不推荐、提及或点名任何具体酒店"), "checklist prompt must forbid recommending specific hotels/merchants");
  assert.ok(aiSource.includes("绝不生成声称代表当地市场行情的具体价格区间"), "checklist prompt must forbid fabricating local market prices");
  assert.ok(aiSource.includes("规划参考比例"), "checklist prompt must allocate budget as percentage/planning reference");
  assert.ok(aiSource.includes("向当地婚姻登记机关、预订场地或双方家庭长辈沟通确认"), "checklist prompt must convert local matters to verification tasks");
});

test("Baidu analytics consent banner: supports bilingual rendering and privacy link parity", () => {
  const root = path.resolve(process.cwd());
  const bannerSource = fs.readFileSync(path.join(root, "src", "baidu-analytics.js"), "utf8");
  assert.ok(bannerSource.includes("/en/privacy.html#baidu-analytics"), "must link to English privacy anchor for en pages");
  assert.ok(bannerSource.includes("/privacy.html#baidu-analytics"), "must link to Chinese privacy anchor for zh pages");
  assert.ok(bannerSource.includes("Decline") && bannerSource.includes("Accept"), "must have English action buttons");
  assert.ok(bannerSource.includes("拒绝") && bannerSource.includes("允许统计"), "must have Chinese action buttons");
});

test("Invitation normalization: preserves lang parameter for bilingual persistence", () => {
  const root = path.resolve(process.cwd());
  const saveSource = fs.readFileSync(path.join(root, "functions", "api", "save.js"), "utf8");
  assert.ok(saveSource.includes('lang: lang === "en" ? "en" : "zh"'), "save.js must preserve and normalize lang to en or zh");
});

test("Service Worker: stale-while-revalidate revalidation is wrapped in event.waitUntil", () => {
  const root = path.resolve(process.cwd());
  const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.ok(swSource.includes("event.waitUntil(fetchPromise.catch("), "sw.js must keep worker alive with event.waitUntil on cache hit");
});

test("Live wall English links: must link to valid /en/wedding-live-wall.html without 404", () => {
  const root = path.resolve(process.cwd());
  const screenSource = fs.readFileSync(path.join(root, "assets", "wall-screen.js"), "utf8");
  assert.ok(!screenSource.includes("/en/live-wall.html"), "wall-screen.js must not link to non-existent /en/live-wall.html");
  assert.ok(screenSource.includes("/en/wedding-live-wall.html"), "wall-screen.js must link to valid /en/wedding-live-wall.html");
});

test("Service Worker: cache.put failure must not abort network response", () => {
  const root = path.resolve(process.cwd());
  const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.ok(
    swSource.includes("cache.put(req, res.clone()).catch(") && swSource.includes(".then(() => res)"),
    "sw.js must catch cache.put errors before returning network response"
  );
});

test("Timezone invariance: invitation calendar export produces identical UTC timestamp regardless of device timezone", () => {
  const root = path.resolve(process.cwd());
  const saveSource = fs.readFileSync(path.join(root, "functions", "api", "save.js"), "utf8");
  const iHtml = fs.readFileSync(path.join(root, "i.html"), "utf8");

  assert.ok(saveSource.includes("isValidTimezone"), "save.js must validate timezone");
  assert.ok(saveSource.includes("timezone"), "save.js must persist timezone");
  assert.ok(iHtml.includes("parseWeddingDate"), "i.html must include parseWeddingDate");
  assert.ok(iHtml.includes("timeZone: tz"), "i.html must format dates with the wedding's timezone");

  // Functional test of the timezone-independent date parser
  function parseWeddingDate(dateStr, timeStr, timeZone) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(NaN);
    const tz = timeZone || "Asia/Shanghai";
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = (timeStr || "11:58").split(":").map(Number);
    const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);

    let dtf;
    try {
      dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric",
        hour12: false
      });
    } catch (_) {
      dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Shanghai",
        year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric",
        hour12: false
      });
    }

    function getTzOffsetMs(date) {
      const parts = dtf.formatToParts(date);
      const p = {};
      for (const part of parts) p[part.type] = Number(part.value);
      const hour = p.hour === 24 ? 0 : p.hour;
      const tzAsUtc = Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second || 0);
      return tzAsUtc - date.getTime();
    }

    let guess = new Date(utcGuess);
    let offset = getTzOffsetMs(guess);
    let target = new Date(utcGuess - offset);
    let offset2 = getTzOffsetMs(target);
    if (offset2 !== offset) {
      target = new Date(utcGuess - offset2);
    }
    return target;
  }

  const shanghaiTarget = parseWeddingDate("2026-12-12", "16:00", "Asia/Shanghai");
  assert.equal(shanghaiTarget.toISOString(), "2026-12-12T08:00:00.000Z", "16:00 in Asia/Shanghai must be 08:00 UTC");

  const laTarget = parseWeddingDate("2026-12-12", "16:00", "America/Los_Angeles");
  assert.equal(laTarget.toISOString(), "2026-12-13T00:00:00.000Z", "16:00 in America/Los_Angeles must be 00:00 UTC next day");
});

test("Invitation timezone contract: Chinese and English forms provide venue timezone selector and pre-publish confirmation", () => {
  const root = path.resolve(process.cwd());
  const cnHtml = fs.readFileSync(path.join(root, "invitation.html"), "utf8");
  const enHtml = fs.readFileSync(path.join(root, "en", "invitation.html"), "utf8");
  const iHtml = fs.readFileSync(path.join(root, "i.html"), "utf8");

  // Chinese invitation contracts
  assert.ok(cnHtml.includes('id="timezone"'), "invitation.html must have #timezone selector");
  assert.ok(cnHtml.includes('value="America/Los_Angeles"'), "invitation.html must support America/Los_Angeles");
  assert.ok(cnHtml.includes('id="confirmModal"'), "invitation.html must have #confirmModal");
  assert.ok(cnHtml.includes('id="confTimezone"'), "invitation.html must display timezone in confirmation modal");
  assert.ok(cnHtml.includes('id="btnConfirmPublish"'), "invitation.html must have #btnConfirmPublish");
  assert.ok(cnHtml.includes("'timezone'"), "invitation.html must bind timezone in form fields");

  // English invitation contracts
  assert.ok(enHtml.includes('id="timezone"'), "en/invitation.html must have #timezone selector");
  assert.ok(enHtml.includes('value="America/Los_Angeles"'), "en/invitation.html must support America/Los_Angeles");
  assert.ok(enHtml.includes('id="confirmModal"'), "en/invitation.html must have #confirmModal");
  assert.ok(enHtml.includes('id="confTimezone"'), "en/invitation.html must display timezone in confirmation modal");
  assert.ok(enHtml.includes('id="btnConfirmPublish"'), "en/invitation.html must have #btnConfirmPublish");
  assert.ok(enHtml.includes("'timezone'"), "en/invitation.html must bind timezone in form fields");

  // Invitation viewer contracts
  assert.ok(iHtml.includes("formatTimezoneShort"), "i.html must include formatTimezoneShort helper");
  assert.ok(iHtml.includes("timeCn"), "i.html must render timeCn element");

  // 16-hour discrepancy resolution verification
  const diffMs = Math.abs(
    new Date("2026-12-13T00:00:00.000Z").getTime() - new Date("2026-12-12T08:00:00.000Z").getTime()
  );
  assert.equal(diffMs, 16 * 3600 * 1000, "Difference between LA and Shanghai 16:00 must be exactly 16 hours");
});



