const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
const urls = [...sitemap.matchAll(/<loc>https:\/\/wedding-tv\.cn\/?([^<]*)<\/loc>/g)].map((match) => match[1] || "index.html");
const risky = [
  /上千场/, /数千(?:场|份)/, /5000\+/, /100\+\s*个城市/,
  /精确到\s*±/, /300dpi/i, /永久(?:链接|分享|保存)/, /版权安全/,
  /豁免协议/, /默认按\s*IP\s*定位/i, /行业基准/, /几乎每场/,
  /性价比最高/, /行业白皮书/, /问卷调研/, /平台实测/,
  /1\s*分钟(?:内)?(?:生成|完成)/, /高清原图/,
];
const errors = [];
const warnings = [];
const seenTitles = new Map();
const seenDescriptions = new Map();

function filesUnder(dir, extension) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(fullPath, extension);
    return entry.name.endsWith(extension) ? [fullPath] : [];
  });
}

if (new Set(urls).size !== urls.length) errors.push("sitemap.xml: duplicate URL");
if (/^\s*Disallow:\s*\/(?:news|insights|blog\/cities)\//im.test(robots)) {
  errors.push("robots.txt: retired URLs must remain crawlable so noindex/404 can be observed");
}
for (const retiredDir of ["blog", "insights", "news"]) {
  if (fs.existsSync(path.join(root, retiredDir))) {
    errors.push(`${retiredDir}: unreviewed generated content directory still exists`);
  }
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

for (const relativePath of ["index.html", "blog.html", "rss.xml", "sitemap.xml"]) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const retiredTarget of ["budget-reference.html", "/blog/cities/", "/insights/", "/news/"]) {
    if (content.includes(retiredTarget)) errors.push(`${relativePath}: links to retired content ${retiredTarget}`);
  }
}

const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (/SITE_STATS|st-(?:views|inquiries|cities)|useDailyJitter/.test(home)) {
  errors.push("index.html: contains unverifiable visitor or usage counters");
}

for (const retiredEndpoint of ["functions/api/debug-env.js", "functions/api/track.js"]) {
  if (fs.existsSync(path.join(root, retiredEndpoint))) {
    errors.push(`${retiredEndpoint}: public diagnostics or behavioral tracking endpoint still exists`);
  }
}
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (/\/api\/(?:debug-env|track)\b/.test(readme)) {
  errors.push("README.md: documentation references a retired public diagnostics or tracking endpoint");
}

const allHtml = filesUnder(root, ".html");
for (const fullPath of allHtml) {
  const relativePath = path.relative(root, fullPath).replaceAll("\\", "/");
  const html = fs.readFileSync(fullPath, "utf8");
  if (/hm\.baidu\.com|\/api\/track\b/.test(html)) {
    errors.push(`${relativePath}: retired analytics or first-party tracking remains`);
  }
}

const serverSource = [path.join(root, "src", "worker.js"), path.join(root, "functions", "_lib.js"), ...filesUnder(path.join(root, "functions", "api"), ".js")]
  .map((sourcePath) => fs.readFileSync(sourcePath, "utf8"))
  .join("\n");
if (/access-control-allow-origin["']?\s*[:,]\s*["']\*/i.test(serverSource)) {
  errors.push("API source: wildcard cross-origin access is enabled");
}
if (/debug-env|["']\/api\/track["']/.test(serverSource)) {
  errors.push("src/worker.js: retired public diagnostics or tracking route remains");
}

const privacy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
for (const provider of ["阿里云百炼", "Google Gemini", "Cloudflare Workers AI"]) {
  if (!privacy.includes(provider)) errors.push(`privacy.html: missing AI provider disclosure (${provider})`);
}
if (!/电子请帖与上传图片[\s\S]{0,160}365 天自动过期/.test(privacy)) {
  errors.push("privacy.html: missing invitation and image retention disclosure");
}
for (const sourcePath of ["functions/api/save.js", "functions/api/upload.js"]) {
  const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
  if (!/expirationTtl/.test(source)) errors.push(`${sourcePath}: public data has no expiration`);
}
const worker = fs.readFileSync(path.join(root, "src/worker.js"), "utf8");
if (!/cloudflare-cdn-cache-control["']\s*,\s*["']no-store/i.test(worker)) {
  errors.push("src/worker.js: indexable documents can remain stale in Cloudflare cache");
}
const wrangler = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
if (!/"run_worker_first"\s*:\s*true/.test(wrangler)) {
  errors.push("wrangler.jsonc: static documents bypass Worker cache controls");
}

const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const navigationCacheBlock = serviceWorker.split("if (isNav) {")[1]?.split("const cacheableAsset")[0] || "";
if (/\.put\s*\(/.test(navigationCacheBlock)) {
  errors.push("sw.js: navigation responses are persisted and can hide reviewed content");
}

const saveSource = fs.readFileSync(path.join(root, "functions", "api", "save.js"), "utf8");
const uploadSource = fs.readFileSync(path.join(root, "functions", "api", "upload.js"), "utf8");
const invitationPage = fs.readFileSync(path.join(root, "i.html"), "utf8");
const posterSource = fs.readFileSync(path.join(root, "functions", "api", "poster.js"), "utf8");
const posterPage = fs.readFileSync(path.join(root, "poster.html"), "utf8");
if (!/normalizeInvitation/.test(saveSource) || !/safeImageUrl/.test(invitationPage)) {
  errors.push("invitation flow: public invitation data is not normalized at write and render boundaries");
}
if (!/hasValidSignature/.test(uploadSource)) {
  errors.push("functions/api/upload.js: uploaded image bytes are not signature checked");
}
if (/JSON\.stringify\(body\)/.test(posterPage) || /function buildPrompt\(\{[^}]*\b(?:groom|bride|date|venue)\b/.test(posterSource)) {
  errors.push("poster flow: AI request includes personal overlay fields that are not needed for background generation");
}
if (/1\s*分钟(?:内)?(?:生成|完成)|高清原图/.test(posterPage)) {
  errors.push("poster.html: contains generation speed or image quality promises that cannot be guaranteed");
}

for (const page of ["speech.html", "vows.html", "checklist.html"]) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  if (/内容不会被存储|你的内容不会被存储|数据仅在本地保存/.test(visibleText(html))) {
    errors.push(`${page}: privacy message conflicts with network-based AI generation`);
  }
}

const workflows = fs.readdirSync(path.join(root, ".github", "workflows"))
  .filter((name) => /auto-(?:cities|insights|news)\.ya?ml$/i.test(name));
if (workflows.length) errors.push(`workflows: unreviewed AI publishing is enabled (${workflows.join(", ")})`);

for (const relativePath of urls) {
  const html = fs.readFileSync(path.join(root, relativePath), "utf8");
  if (/wedding-tv\.cn 编辑组|作者与审校团队/.test(html)) {
    errors.push(`${relativePath}: implies an undisclosed editorial team`);
  }
}

for (const relativePath of urls) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${relativePath}: sitemap target missing`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8");
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim();
  const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1].trim();
  const robots = html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] || "";
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1];
  const text = visibleText(html);

  if (!title) errors.push(`${relativePath}: missing title`);
  if (!description) errors.push(`${relativePath}: missing description`);
  if (!canonical) errors.push(`${relativePath}: missing canonical`);
  if (/noindex/i.test(robots)) errors.push(`${relativePath}: noindex page is in sitemap`);
  if (!/authors\.html|name="author"/i.test(html)) warnings.push(`${relativePath}: no organization author/responsibility link`);
  if (text.length < 500) warnings.push(`${relativePath}: visible text is short (${text.length})`);

  for (const pattern of risky) {
    if (pattern.test(text)) errors.push(`${relativePath}: risky unsupported wording ${pattern}`);
  }

  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(block[1]); }
    catch (error) { errors.push(`${relativePath}: invalid JSON-LD (${error.message})`); }
  }

  for (const block of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/ld\+json|module)")[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!block[1].trim()) continue;
    try { new vm.Script(block[1], { filename: relativePath }); }
    catch (error) { errors.push(`${relativePath}: inline JavaScript syntax error (${error.message})`); }
  }

  const linkSource = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  for (const link of linkSource.matchAll(/href="(\/[^"#?]*)/gi)) {
    const href = decodeURIComponent(link[1]);
    if (!href || href === "/" || href.startsWith("/api/")) continue;
    const localPath = href.endsWith("/") ? `${href.slice(1)}index.html` : href.slice(1);
    if (!fs.existsSync(path.join(root, localPath))) {
      errors.push(`${relativePath}: broken local link ${href}`);
    }
  }

  if (title) {
    if (seenTitles.has(title)) errors.push(`${relativePath}: duplicate title with ${seenTitles.get(title)}`);
    else seenTitles.set(title, relativePath);
  }
  if (description) {
    if (seenDescriptions.has(description)) errors.push(`${relativePath}: duplicate description with ${seenDescriptions.get(description)}`);
    else seenDescriptions.set(description, relativePath);
  }
}

console.log(`Indexed pages: ${urls.length}`);
console.log(`Errors: ${errors.length}`);
for (const error of errors) console.log(`ERROR ${error}`);
console.log(`Warnings: ${warnings.length}`);
for (const warning of warnings) console.log(`WARN ${warning}`);
process.exitCode = errors.length ? 1 : 0;
