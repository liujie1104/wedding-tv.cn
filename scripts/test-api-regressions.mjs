// Automated regression tests for Cloudflare Worker API contracts, frontend image resolution, and quota execution order
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { onRequestGet as posterImgGet } from "../functions/api/poster-img.js";
import { onRequestGet as posterGet, onRequestPost as posterPost } from "../functions/api/poster.js";
import { onRequestPost as uploadPost } from "../functions/api/upload.js";
import { onRequestPost as savePost } from "../functions/api/save.js";

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
            results: [{ url: mockOssUrl }],
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

test("Policy pages date integrity: privacy and terms dates are strictly synchronized", async () => {
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
  const privVisDateMatch = privacyHtml.match(/最后更新：(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const privVisDate = privVisDateMatch ? `${privVisDateMatch[1]}-${String(privVisDateMatch[2]).padStart(2, "0")}-${String(privVisDateMatch[3]).padStart(2, "0")}` : null;
  const privStatusDateMatch = privacyHtml.match(/当前状态[（(](\d{4})年(\d{1,2})月(\d{1,2})日/);
  const privStatusDate = privStatusDateMatch ? `${privStatusDateMatch[1]}-${String(privStatusDateMatch[2]).padStart(2, "0")}-${String(privStatusDateMatch[3]).padStart(2, "0")}` : null;
  const privSitemapDate = getSitemapLastmod("privacy.html");

  assert.equal(privJsonDate, "2026-09-01", "privacy.html JSON-LD dateModified must be 2026-09-01");
  assert.equal(privVisDate, "2026-09-01", "privacy.html visible date must be 2026-09-01");
  assert.equal(privStatusDate, "2026-09-01", "privacy.html current status date must be 2026-09-01");
  assert.equal(privSitemapDate, "2026-09-01", "privacy.html sitemap lastmod must be 2026-09-01");

  // 2. Check terms.html
  const termsHtml = fs.readFileSync(path.join(root, "terms.html"), "utf8");
  const termsJsonDate = termsHtml.match(/"dateModified":\s*"([^"]+)"/)?.[1];
  const termsVisDateMatch = termsHtml.match(/最后更新：(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const termsVisDate = termsVisDateMatch ? `${termsVisDateMatch[1]}-${String(termsVisDateMatch[2]).padStart(2, "0")}-${String(termsVisDateMatch[3]).padStart(2, "0")}` : null;
  const termsSitemapDate = getSitemapLastmod("terms.html");

  assert.equal(termsJsonDate, "2026-09-01", "terms.html JSON-LD dateModified must be 2026-09-01");
  assert.equal(termsVisDate, "2026-09-01", "terms.html visible date must be 2026-09-01");
  assert.equal(termsSitemapDate, "2026-09-01", "terms.html sitemap lastmod must be 2026-09-01");
});
