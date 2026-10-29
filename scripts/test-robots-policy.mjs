import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../src/worker.js";

const robots = fs.readFileSync(new URL("../robots.txt", import.meta.url), "utf8");
const groups = robots.split(/\r?\n\s*\r?\n/).map((block) => {
  const fields = block.split(/\r?\n/).flatMap((raw) => {
    const line = raw.split("#")[0].trim();
    const separator = line.indexOf(":");
    return separator < 0 ? [] : [[line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim()]];
  });
  return {
    agents: fields.filter(([key]) => key === "user-agent").map(([, value]) => value.toLowerCase()),
    allow: fields.filter(([key]) => key === "allow").map(([, value]) => value),
    disallow: fields.filter(([key]) => key === "disallow").map(([, value]) => value),
  };
}).filter((group) => group.agents.length);

test("Robots policy: public search remains allowed and Baiduspider has no conflicting group", () => {
  const general = groups.filter((group) => group.agents.includes("*"));
  assert.equal(general.length, 1);
  assert.deepEqual(general[0].allow, ["/"]);
  assert.deepEqual(general[0].disallow, []);
  const baidu = groups.filter((group) => group.agents.includes("baiduspider"));
  assert.equal(baidu.length, 1);
  assert.deepEqual(baidu[0].allow, ["/"]);
  assert.deepEqual(baidu[0].disallow, []);
  for (const agent of ["googlebot", "bingbot", "mediapartners-google", "adsbot-google"]) {
    assert(!groups.some((group) => group.agents.includes(agent) && group.disallow.length), agent);
  }
  assert.match(robots, /^Sitemap: https:\/\/wedding-tv\.cn\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /# BEGIN Cloudflare Managed content/i);
});

test("Robots policy: all 31 other crawler restrictions from the 2026-10-29 snapshot remain", () => {
  const expected = [
    "amazonbot", "anthropic-ai", "applebot-extended", "atlassian-bot", "awariorssbot", "awariosmartbot",
    "borderxbot", "bytespider", "ccbot", "citibotsitecrawler", "claude-web", "claudebot", "cohere-ai",
    "cotoyogi", "diffbot", "fishbot", "google-cloudvertexbot", "google-extended", "googleother", "gptbot",
    "icc-crawler", "kimibot", "magpie-crawler", "meta-externalagent", "mistralai-training", "navubot",
    "omgili", "petalbot", "qualifiedbot", "semrushbot-swa", "wardbot",
  ].sort();
  const restricted = groups.filter((group) => group.disallow.includes("/")).flatMap((group) => group.agents).sort();
  assert.deepEqual(restricted, expected);
  for (const group of groups.filter((group) => group.disallow.length)) {
    assert.deepEqual(group.disallow, ["/"]);
    assert.deepEqual(group.allow, []);
  }
  assert.match(robots, /^Content-Signal: search=yes,ai-train=no,use=reference$/m);
});

test("Worker serves robots as fresh plain text without analytics or HTML rewriting", async () => {
  const response = await worker.fetch(new Request("https://wedding-tv.cn/robots.txt?check=policy"), {
    ASSETS: { fetch: async () => new Response(robots, { headers: { "content-type": "text/plain; charset=utf-8" } }) },
  }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/plain/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("cloudflare-cdn-cache-control"), "no-store");
  assert.equal(await response.text(), robots);
});
