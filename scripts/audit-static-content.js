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
];
const errors = [];
const warnings = [];
const seenTitles = new Map();
const seenDescriptions = new Map();

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
