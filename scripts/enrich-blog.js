#!/usr/bin/env node
// 给 34 个 blog 页一次性补全：
// 1) FAQ JSON-LD (5 个常见问题，触发 Google 问答框富媒体片段)
// 2) 地理分区的"相邻地区"内部链接 (替换原 related 块)
const fs = require('fs');
const path = require('path');

// 中文名 + 地理分区
const REGIONS = {
  // 华北
  beijing:    { name:'北京', zone:'华北' },
  tianjin:    { name:'天津', zone:'华北' },
  hebei:      { name:'河北', zone:'华北' },
  shanxi:     { name:'山西', zone:'华北' },
  neimenggu:  { name:'内蒙古', zone:'华北' },
  // 东北
  liaoning:   { name:'辽宁', zone:'东北' },
  jilin:      { name:'吉林', zone:'东北' },
  heilongjiang:{ name:'黑龙江', zone:'东北' },
  // 华东
  shanghai:   { name:'上海', zone:'华东' },
  jiangsu:    { name:'江苏', zone:'华东' },
  zhejiang:   { name:'浙江', zone:'华东' },
  anhui:      { name:'安徽', zone:'华东' },
  fujian:     { name:'福建', zone:'华东' },
  jiangxi:    { name:'江西', zone:'华东' },
  shandong:   { name:'山东', zone:'华东' },
  taiwan:     { name:'台湾', zone:'华东' },
  // 华中
  henan:      { name:'河南', zone:'华中' },
  hubei:      { name:'湖北', zone:'华中' },
  hunan:      { name:'湖南', zone:'华中' },
  // 华南
  guangdong:  { name:'广东', zone:'华南' },
  guangxi:    { name:'广西', zone:'华南' },
  hainan:     { name:'海南', zone:'华南' },
  xianggang:  { name:'香港', zone:'华南' },
  aomen:      { name:'澳门', zone:'华南' },
  // 西南
  chongqing:  { name:'重庆', zone:'西南' },
  sichuan:    { name:'四川', zone:'西南' },
  guizhou:    { name:'贵州', zone:'西南' },
  yunnan:     { name:'云南', zone:'西南' },
  xizang:     { name:'西藏', zone:'西南' },
  // 西北
  shaanxi:    { name:'陕西', zone:'西北' },
  gansu:      { name:'甘肃', zone:'西北' },
  qinghai:    { name:'青海', zone:'西北' },
  ningxia:    { name:'宁夏', zone:'西北' },
  xinjiang:   { name:'新疆', zone:'西北' }
};

// 按分区分组
const byZone = {};
for (const [k, v] of Object.entries(REGIONS)) {
  (byZone[v.zone] = byZone[v.zone] || []).push({ key:k, name:v.name });
}

// 5 个 FAQ 问答模板（基于实战 SEO 长尾词研究）
function buildFAQ(regionKey, regionName) {
  return [
    {
      q: `${regionName}婚礼彩礼一般多少钱？`,
      a: `${regionName}地区彩礼因城乡、家庭条件差异较大，城市常见区间为 6.6 万 - 18.8 万元（含"三金/五金"约 2-4 万），县级和农村地区 3.8 万 - 8.8 万元较常见。彩礼讲究"成双成对、好事成双"，避开 4 等不吉数字。许多家庭会"彩礼陪嫁两家共出"——女方把彩礼连同自有嫁妆一并带回新家。`
    },
    {
      q: `${regionName}婚礼有哪些必备习俗？`,
      a: `${regionName}传统婚俗核心环节包括：提亲（媒人或男方家长上门）、订婚（过定/下定）、过大礼（送彩礼）、迎亲（接新娘）、敬茶改口、典礼宴请、回门。许多地区还保留跨火盆、撑红伞、新娘脚不沾娘家土等古礼，寓意吉祥顺遂。`
    },
    {
      q: `${regionName}婚礼当天的流程一般是怎样的？`,
      a: `典型流程：清晨 5:30-6:00 新娘化妆 → 8:00-9:00 新郎到达堵门游戏 → 9:30 敬茶改口接新娘 → 10:30 新娘抵达男方家敬茶 → 11:30 酒店签到迎宾 → 12:00 中式或西式典礼 → 12:30-14:00 宴席+逐桌敬酒 → 14:30 送客合影 → 当晚或次日回门。具体时间可用 wedding-tv.cn 流程时间轴工具自动排版。`
    },
    {
      q: `${regionName}结婚有什么禁忌？`,
      a: `常见禁忌：婚期避开农历七月、清明、单数月单数日；新人婚前一晚不同房；新娘出门不回头、脚不沾娘家土；婚车数量取双、车队不走回头路；婚宴菜避双数中的 4，整鱼留头尾寓意"有头有尾"；孕妇、寡妇、属相相冲者不参与铺床和送嫁。`
    },
    {
      q: `${regionName}婚宴一桌大概多少钱？`,
      a: `${regionName}婚宴酒席价格因城市等级、酒店档次差异较大：省会四星级酒店 1880-3880 元/桌较常见，五星级 3880-6880 元/桌；地级市常见 1280-2680 元/桌；县城及农村自办流水席 800-1500 元/桌。10 人/桌起算，平均每位宾客成本约 180-380 元。`
    }
  ];
}

// 生成相邻地区链接（同分区其他省份 + 1 个跨区"明星"地区）
function buildRelatedLinks(currentKey) {
  const zone = REGIONS[currentKey].zone;
  const sameZone = byZone[zone].filter(r => r.key !== currentKey);
  const links = sameZone.slice(0, 5).map(r =>
    `<a href="/blog/${r.key}.html">📍 ${r.name}婚俗 - 同属${zone}地区 →</a>`
  );
  return links.join('\n  ');
}

let modified = 0;
for (const key of Object.keys(REGIONS)) {
  const file = path.join('blog', `${key}.html`);
  if (!fs.existsSync(file)) { console.log(`× 找不到 ${file}`); continue; }

  let html = fs.readFileSync(file, 'utf8');
  const region = REGIONS[key];

  // ---- 1) 插入 FAQ JSON-LD ----
  if (!/"@type":"FAQPage"/.test(html)) {
    const faqs = buildFAQ(key, region.name);
    const faqJson = {
      '@context':'https://schema.org',
      '@type':'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type':'Question',
        name: f.q,
        acceptedAnswer: { '@type':'Answer', text: f.a }
      }))
    };
    const faqScript = `<script type="application/ld+json">\n${JSON.stringify(faqJson)}\n</script>`;

    // 在第一个 </script> 之后（即 Article JSON-LD 后面）插入
    html = html.replace(
      /(<script type="application\/ld\+json">[\s\S]*?<\/script>)/,
      `$1\n${faqScript}`
    );
  }

  // ---- 2) 在文章末尾新增可见的 FAQ 区块 (用户也能看到，且加强 schema 信号) ----
  if (!/class="faq-section"/.test(html)) {
    const faqs = buildFAQ(key, region.name);
    const faqHtml = `
<section class="faq-section" style="margin:40px 0 24px;padding:24px;background:var(--card);border:1px solid var(--line);border-radius:12px">
  <h2 style="margin-top:0">❓ ${region.name}婚礼常见问题</h2>
${faqs.map(f => `  <details style="margin:14px 0;padding:12px 14px;background:#0e0a14;border-radius:8px;border:1px solid var(--line)">
    <summary style="cursor:pointer;font-weight:600;color:var(--accent)">${f.q}</summary>
    <p style="margin:10px 0 0;color:var(--fg);line-height:1.85">${f.a}</p>
  </details>`).join('\n')}
</section>`;
    // 插入到 <div class="cta"> 之前
    if (html.includes('<div class="cta">')) {
      html = html.replace('<div class="cta">', `${faqHtml}\n\n<div class="cta">`);
    }
  }

  // ---- 3) 增强 related 区块：插入同分区相邻地区链接 ----
  const relatedLinks = buildRelatedLinks(key);
  // 检查是否已经插入过分区链接（幂等）
  if (!html.includes('同属' + region.zone + '地区')) {
    // 在 related 区块的"查看全部 34 个"链接之后插入
    html = html.replace(
      /(<h3>\s*<a href="\/blog\.html#regions">查看全部 34 个省[^<]*<\/a><\/h3>)/,
      `$1\n  <p style="margin:8px 0 12px;color:var(--mute);font-size:13px">🗺️ ${region.zone}地区其他婚俗：</p>\n  ${relatedLinks}\n  <p style="margin:14px 0 8px;color:var(--mute);font-size:13px">📚 实用工具：</p>`
    );
  }

  fs.writeFileSync(file, html, 'utf8');
  modified++;
}

console.log(`✓ 已增强 ${modified} 个 blog 页面（FAQ Schema + 可见 FAQ + 分区互链）`);
