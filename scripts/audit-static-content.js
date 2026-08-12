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
const reviewedRegionPages = new Set([
  "blog/guangdong.html",
  "blog/fujian.html",
  "blog/hunan.html",
  "blog/sichuan.html",
  "blog/zhejiang.html",
  "blog/inner-mongolia.html",
  "blog/gansu.html",
  "blog/qinghai.html",
  "blog/heilongjiang.html",
  "blog/jilin.html",
  "blog/beijing.html",
  "blog/tianjin.html",
  "blog/shanghai.html",
  "blog/chongqing.html",
  "blog/jiangsu.html",
  "blog/hebei.html",
  "blog/shanxi.html",
  "blog/liaoning.html",
  "blog/anhui.html",
  "blog/shandong.html",
  "blog/henan.html",
  "blog/hubei.html",
  "blog/jiangxi.html",
  "blog/shaanxi.html",
  "blog/guizhou.html",
  "blog/hainan.html",
  "blog/yunnan.html",
  "blog/guangxi.html",
  "blog/ningxia.html",
  "blog/xinjiang.html",
  "blog/tibet.html",
  "blog/taiwan.html",
  "blog/hong-kong.html",
  "blog/macao.html",
]);
const requiredConcreteSignals = new Map([
  ["blog/guangdong.html", [/订婚、认亲、择日、婚礼、回门/, /先生公/, /猪肝饭/, /划旱船/, /大碗疍/]],
  ["blog/fujian.html", [/杉刺拦路求对歌/, /伴娘妈、送嫁嫂或佬嫂/, /线须/, /赤郎子/, /歌桌怎样开席/]],
  ["blog/hunan.html", [/哭开声/, /包席/, /赶边边场/, /插花日/, /媒公/, /打蹈/]],
  ["blog/sichuan.html", [/克斯.*克智.*佐/s, /互换腰带/, /咪哆/, /蝴蝶妈妈纹/, /史尔俄特/]],
  ["blog/zhejiang.html", [/定情、做媒、相亲、备嫁妆、迎嫁妆/, /送糯米/, /踏路牛/, /车郎/, /doi/]],
  ["blog/inner-mongolia.html", [/祝赞词家/, /勒勒车/, /阿日奔苏木/, /长调民歌/]],
  ["blog/gansu.html", [/28个礼节/, /杜苏尔池/, /阿斯哈斯/, /总东/, /戴头面/]],
  ["blog/qinghai.html", [/纳什金/, /白母羊/, /花儿.*对歌/s, /安昭/, /婚姻自由/]],
  ["blog/heilongjiang.html", [/彩船.*彩橇/s, /芦苇杖/, /戒语/, /做福/, /三乡两村/]],
  ["blog/jilin.html", [/议婚.*大礼.*后礼/s, /礼装函/, /奠雁礼/, /三个鸡蛋/, /回婚礼/]],
  ["blog/beijing.html", [/小定.*大定/s, /雁酒/, /天地桌/, /牛角灯/, /闹洞房/]],
  ["blog/tianjin.html", [/搭大棚落座/, /八大碗/, /下午办婚礼/, /街坊邻居/, /移民城市/]],
  ["blog/shanghai.html", [/百子大礼轿/, /1952年12月/, /海派旗袍/, /婚姻文化展示馆/, /奉贤/]],
  ["blog/chongqing.html", [/花园酒/, /巴巴髻/, /头嘎.*二嘎.*摸米/s, /拦门礼/, /哭嫁歌/]],
  ["blog/jiangsu.html", [/婚船彩棚/, /摇快船/, /铺米袋/, /走三桥/, /张厅有囍/]],
  ["blog/hebei.html", [/妞、㧟、丑、公子/, /排街秧歌/, /场子秧歌/, /傻柱子接媳妇/, /田寨村/]],
  ["blog/shanxi.html", [/过帖.*换帖/s, /许口面/, /散喜馍/, /上头糕/, /出十二/]],
  ["blog/liaoning.html", [/蒙古勒津婚礼/, /红帽子镇/, /武国强/, /蒙古贞之恋/, /朝鲜族传统婚礼/]],
  ["blog/anhui.html", [/说媒、行聘、请期/, /送担/, /搬行嫁/, /得定/, /借镬/]],
  ["blog/shandong.html", [/黄县龙凤花轿婚俗/, /胶东花饽饽/, /龙凤呈祥/, /开洋谢洋/, /鲅鱼水饺/]],
  ["blog/henan.html", [/说媒、相亲、换贴/, /看好、送红/, /嵩山婚俗/, /婚船/, /六礼/]],
  ["blog/hubei.html", [/女婚男嫁/, /金凤引青龙/, /丈母娘抬软轿/, /娶新郎/, /娶女婿/]],
  ["blog/jiangxi.html", [/扎庚/, /睄节/, /祖宗纱代/, /踩红筷子/, /同心餐/]],
  ["blog/shaanxi.html", [/择亲、提亲、订亲、商话/, /稳根鞋/, /长命带/, /结缘发/, /参厨/]],
  ["blog/guizhou.html", [/夜间对歌/, /拦门酒/, /糯米、喜糖、鸭和猪肉/, /第一担井水/, /行歌坐月/]],
  ["blog/hainan.html", [/黎族传统婚礼/, /海南三亚回族婚礼/, /三米多长的木杆/, /山栏糯米酒/, /尼卡哈/]],
  ["blog/yunnan.html", [/雷响茶/, /核桃仁与红糖/, /蜂蜜和少量花椒、桂皮/, /25首章哈习俗歌/, /彝族（花腰）婚嫁习俗/]],
  ["blog/guangxi.html", [/卢瑞明/, /头峒/, /乜相/, /拦路关/, /两句一顿，每句七字/]],
  ["blog/ningxia.html", [/提亲、看家道、相亲、道喜/, /念尼卡哈/, /唱家子/, /表针线/, /酒曲子/]],
  ["blog/xinjiang.html", [/送订亲礼.*送大礼/s, /阿吉萨林/, /安巴萨林/, /击鼓祝福/, /盐水.*馕/s]],
  ["blog/tibet.html", [/三次提亲/, /彩箭.*达塔/s, /门赞/, /巴地赞/, /陈塘夏尔巴婚俗/]],
  ["blog/taiwan.html", [/吃姊妹桌/, /二礼/, /送采薪礼/, /tokang/, /tmlung qsiya msdhug/]],
  ["blog/hong-kong.html", [/出嫁前两天/, /叹歌/, /咸水歌/, /鹤佬渔民/, /龙凤/]],
  ["blog/macao.html", [/纳采请婚、问名相亲/, /过大礼/, /嫁喜礼饼制作技艺/, /歌堂酒/, /九十日/]],
]);
const flagshipEvidencePages = new Set([
  "blog/guangdong.html",
  "blog/fujian.html",
  "blog/sichuan.html",
  "blog/tibet.html",
  "blog/taiwan.html",
  "blog/hong-kong.html",
]);
const forbiddenRegionBoilerplate = /<h2>[^<]*(?:家庭核对表|家庭访谈|供应商交底|供应商的执行|婚庆.*交底|假设情境|建议执行步骤|建议确认流程|争议事项)[^<]*<\/h2>/;

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
for (const retiredDir of ["insights", "news"]) {
  if (fs.existsSync(path.join(root, retiredDir))) {
    errors.push(`${retiredDir}: unreviewed generated content directory still exists`);
  }
}
const publishedRegionPages = filesUnder(path.join(root, "blog"), ".html")
  .map((fullPath) => path.relative(root, fullPath).replaceAll("\\", "/"));
for (const relativePath of publishedRegionPages) {
  if (!reviewedRegionPages.has(relativePath)) {
    errors.push(`${relativePath}: region page has not been added to the reviewed publication allowlist`);
  }
}
for (const relativePath of reviewedRegionPages) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${relativePath}: reviewed region page is missing`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8");
  const sourceCount = [...html.matchAll(/<a\b[^>]*\bdata-source\b/gi)].length;
  const sectionCount = [...html.matchAll(/<h2\b/gi)].length;
  const tableCount = [...html.matchAll(/<table\b/gi)].length;
  const textLength = visibleText(html).length;
  if (sourceCount < 3) errors.push(`${relativePath}: fewer than 3 traceable sources (${sourceCount})`);
  if (textLength < 2500) errors.push(`${relativePath}: reviewed regional longform is too short (${textLength})`);
  if (sectionCount < 8) errors.push(`${relativePath}: reviewed regional longform lacks depth (${sectionCount} sections)`);
  if (tableCount < 1) errors.push(`${relativePath}: reviewed regional longform needs at least one factual structure table (${tableCount})`);
  if (!/AI 辅助说明/.test(html)) errors.push(`${relativePath}: missing AI assistance disclosure`);
  if (!/(?:适用边界|范围声明|阅读原则|本页定位|特别提示)/.test(html)) {
    errors.push(`${relativePath}: missing locality and applicability boundary`);
  }
  if (forbiddenRegionBoilerplate.test(html)) {
    errors.push(`${relativePath}: generic planning boilerplate remains in a factual regional article`);
  }
  for (const signal of requiredConcreteSignals.get(relativePath) || []) {
    if (!signal.test(html)) errors.push(`${relativePath}: missing a required source-specific fact (${signal})`);
  }
  if (!/wedding-tv\.cn 内容维护/.test(html) || !/authors\.html/.test(html)) {
    errors.push(`${relativePath}: missing organization responsibility statement`);
  }
  if (flagshipEvidencePages.has(relativePath)) {
    const evidenceFlowCount = [...html.matchAll(/\bdata-evidence-flow\b/gi)].length;
    const evidenceSourceCount = [...html.matchAll(/\bdata-evidence-source\b/gi)].length;
    const evidenceTableHtml = html.match(/<table class="evidence-table">[\s\S]*?<\/table>/i)?.[0] || "";
    const evidenceDateCount = [...evidenceTableHtml.matchAll(/<td>\d{4}-\d{2}-\d{2}<\/td>/gi)].length;
    if (evidenceFlowCount !== 1) errors.push(`${relativePath}: flagship page needs one original evidence flow (${evidenceFlowCount})`);
    if (evidenceSourceCount < 4) errors.push(`${relativePath}: flagship page needs at least 4 claim-to-source records (${evidenceSourceCount})`);
    if (evidenceDateCount < evidenceSourceCount) errors.push(`${relativePath}: evidence records need a verification date`);
    if (!/本站采用的关键事实/.test(html) || !/适用范围/.test(html)) {
      errors.push(`${relativePath}: evidence table is missing claim or applicability fields`);
    }
  }
  for (const unsupportedLegacyClaim of [/彩礼一般多少钱/, /城市常见区间/, /婚宴一桌/, /单去双回/, /新娘脚不能沾/]) {
    if (unsupportedLegacyClaim.test(html)) {
      errors.push(`${relativePath}: contains unsupported claim from the retired regional template ${unsupportedLegacyClaim}`);
    }
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
if (!wrangler.includes('"html_handling": "none"')) {
  errors.push("wrangler.jsonc: .html canonical URLs must not be redirected by Cloudflare HTML handling");
}
if (!worker.includes("canonicalHtmlRedirect") || !worker.includes("status: 301")) {
  errors.push("src/worker.js: extensionless document variants need a permanent redirect to .html canonical URLs");
}

const editorialPolicy = fs.readFileSync(path.join(root, "editorial-policy.html"), "utf8");
if (/必须包含双方家庭核对表/.test(editorialPolicy) || /还须包含家庭访谈方法、供应商交底/.test(editorialPolicy)) {
  errors.push("editorial-policy.html: superseded regional article template requirements remain");
}
if (!/不使用可以复制到任何地区的家庭核对表/.test(editorialPolicy) || !/事实—来源—范围/.test(editorialPolicy)) {
  errors.push("editorial-policy.html: current source-specific regional review standard is missing");
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
  const expectedCanonical = relativePath === "index.html"
    ? "https://wedding-tv.cn/"
    : `https://wedding-tv.cn/${relativePath}`;
  const text = visibleText(html);

  if (!title) errors.push(`${relativePath}: missing title`);
  if (!description) errors.push(`${relativePath}: missing description`);
  if (!canonical) errors.push(`${relativePath}: missing canonical`);
  if (canonical && canonical !== expectedCanonical) {
    errors.push(`${relativePath}: canonical ${canonical} does not match sitemap URL ${expectedCanonical}`);
  }
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
