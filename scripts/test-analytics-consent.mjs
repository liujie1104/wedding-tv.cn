import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import {
  ANALYTICS_CONSENT_STORAGE_KEY as KEY,
  BAIDU_CONSENT_STORAGE_KEY as OLD_KEY,
  CLARITY_PROJECT_ID,
  buildAnalyticsSnippet,
  shouldInjectClarityAnalytics,
} from "../src/baidu-analytics.js";

function browser({ pathname = "/", stored = {}, search = "", hash = "", referrer = "", storageFails = false, readyState = "complete" } = {}) {
  const storage = new Map(Object.entries(stored));
  const elements = new Map(), scripts = [], windowEvents = {}, documentEvents = {}, cookies = [];
  let reloads = 0;
  function element(tag) {
    return {
      tagName: tag.toUpperCase(), style: {}, attributes: {}, events: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(type, handler) { this.events[type] = handler; },
      remove() { elements.delete(this.id); },
    };
  }
  const masked = element("input");
  const document = {
    readyState, referrer, documentElement: { lang: pathname.startsWith("/en/") ? "en" : "zh-CN" },
    head: { appendChild(node) { scripts.push(node); } },
    body: { appendChild(node) { elements.set(node.id, node); } },
    getElementById(id) { return elements.get(id); },
    getElementsByTagName() { return []; },
    querySelectorAll() { return [masked]; },
    createElement: element,
    addEventListener(type, handler) { documentEvents[type] = handler; },
    set cookie(value) { cookies.push(value); },
  };
  const window = { addEventListener(type, handler) { windowEvents[type] = handler; } };
  const location = new URL("https://wedding-tv.cn" + pathname + search + hash);
  location.reload = () => { reloads++; };
  const localStorage = {
    getItem(key) { if (storageFails) throw new Error("storage blocked"); return storage.get(key) ?? null; },
    setItem(key, value) { if (storageFails) throw new Error("storage blocked"); storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
  };
  const context = vm.createContext({ window, document, location, localStorage, URL });
  const source = buildAnalyticsSnippet(pathname).replace(/^<script[^>]*>\s*/, "").replace(/<\/script>$/, "");
  vm.runInContext(source, context);
  return {
    window, storage, scripts, cookies, masked, documentEvents,
    get reloads() { return reloads; },
    get banner() { return elements.get("wedding-analytics-consent"); },
    get clarityScripts() { return scripts.filter(s => s.src?.startsWith("https://www.clarity.ms/tag/")); },
    choose(value) { this.banner.events.click({ target: { closest: () => ({ getAttribute: () => value }) } }); },
    rerun() { vm.runInContext(source, context); },
    storageEvent(value) {
      if (value === null) storage.delete(KEY); else storage.set(KEY, value);
      windowEvents.storage({ key: KEY });
    },
  };
}

test("Analytics: no provider request before a new consent, and rejection persists", () => {
  const b = browser();
  assert.equal(b.scripts.length, 0);
  assert.match(b.banner.innerHTML, /Microsoft Clarity/);
  b.choose("denied");
  assert.equal(b.scripts.length, 0);
  assert.equal(b.storage.get(KEY), "denied");
  assert.equal(browser({ stored: { [KEY]: "denied" } }).banner, undefined);
});

test("Analytics: old Baidu acceptance never authorizes Clarity; old refusal remains effective", () => {
  for (const old of ["granted", "denied"]) {
    const b = browser({ stored: { [OLD_KEY]: old } });
    assert.equal(b.scripts.length, 0);
    assert.equal(Boolean(b.banner), old === "granted");
  }
  const malformed = browser({ stored: { [KEY]: "unexpected" } });
  assert.ok(malformed.banner);
  assert.equal(malformed.scripts.length, 0);
});

test("Analytics: new consent loads each provider once, masks forms and denies ad storage", () => {
  const b = browser({ pathname: "/en/" });
  assert.match(b.banner.innerHTML, /session replays/);
  b.choose("granted");
  b.rerun();
  assert.equal(b.scripts.length, 2);
  assert.equal(b.clarityScripts[0].src, "https://www.clarity.ms/tag/" + CLARITY_PROJECT_ID);
  assert.equal(b.masked.attributes["data-clarity-mask"], "true");
  const [command, consent] = b.window.clarity.q[0];
  assert.equal(command, "consentv2");
  assert.equal(consent.analytics_Storage, "granted");
  assert.equal(consent.ad_Storage, "denied");
});

test("Clarity: unknown routes, tool inputs, UGC and policy pages are default-denied", () => {
  for (const pathname of ["/", "/en/", "/blog.html", "/blog/hunan.html", "/wedding-day-timeline-guide.html"]) {
    assert.equal(shouldInjectClarityAnalytics(pathname), true, pathname);
  }
  for (const pathname of ["/new-tool.html", "/api/load", "/i/abc12345", "/i.html", "/blessing.html", "/live-wall.html", "/invitation.html", "/en/invitation.html", "/wedding-live-wall.html", "/en/wedding-live-wall.html", "/ai-planner.html", "/poster.html", "/vows.html", "/en/vows.html", "/speech.html", "/timeline.html", "/checklist.html", "/quote-comparison.html", "/privacy.html", "/en/privacy.html", "/terms.html"]) {
    assert.equal(shouldInjectClarityAnalytics(pathname), false, pathname);
    assert.equal(browser({ pathname, stored: { [KEY]: "granted" } }).clarityScripts.length, 0, pathname);
  }
});

test("Clarity: URL parameters, fragments and private same-site referrers are not recorded", () => {
  for (const options of [
    { search: "?room=secret" }, { search: "?utm_source=review" }, { hash: "#admin=secret" },
    { referrer: "https://wedding-tv.cn/i/abc12345" },
    { referrer: "https://wedding-tv.cn/live-wall.html?room=secret" },
    { referrer: "https://wedding-tv.cn/?id=secret" },
  ]) {
    const b = browser({ ...options, stored: { [KEY]: "granted" } });
    assert.equal(b.clarityScripts.length, 0);
  }
  assert.equal(browser({ referrer: "https://wedding-tv.cn/blog/hunan.html", stored: { [KEY]: "granted" } }).clarityScripts.length, 1);
});

test("Analytics: consent withdrawal clears analytics cookies, preserves tool data and reloads", () => {
  const b = browser({ stored: { [KEY]: "granted", [OLD_KEY]: "granted", wedding_draft: "keep" } });
  b.window.WeddingAnalyticsConsent.reset();
  assert.equal(b.storage.has(KEY), false);
  assert.equal(b.storage.has(OLD_KEY), false);
  assert.equal(b.storage.get("wedding_draft"), "keep");
  assert.equal(b.reloads, 1);
  assert.ok(b.cookies.some(c => c.startsWith("_clck=")));
  const [, consent] = b.window.clarity.q.at(-1);
  assert.equal(consent.analytics_Storage, "denied");
  assert.equal(consent.ad_Storage, "denied");
  const other = browser({ stored: { [KEY]: "granted" } });
  other.storageEvent("denied");
  assert.equal(other.reloads, 1);
  const pending = browser({ readyState: "loading", stored: { [KEY]: "granted" } });
  pending.window.WeddingAnalyticsConsent.reset();
  pending.documentEvents.DOMContentLoaded();
  assert.equal(pending.clarityScripts.length, 0);
});

test("Analytics: blocked local storage remains opt-in and does not break page controls", () => {
  const b = browser({ storageFails: true });
  assert.equal(b.scripts.length, 0);
  b.choose("granted");
  assert.equal(b.clarityScripts.length, 1);
  b.window.WeddingAnalyticsConsent.reset();
  assert.equal(b.reloads, 1);
});

test("Service Worker never intercepts Clarity scripts or collection requests", () => {
  const handlers = {};
  const context = vm.createContext({ self: { addEventListener(type, handler) { handlers[type] = handler; } }, URL });
  vm.runInContext(fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8"), context);
  for (const url of ["https://www.clarity.ms/tag/ym2xvwuebv", "https://scripts.clarity.ms/0.1/clarity.js", "https://a.clarity.ms/collect", "https://clarity.microsoft.com/script.js"]) {
    let intercepted = false;
    handlers.fetch({ request: { url, method: "GET", destination: "script" }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});
