#!/usr/bin/env node
// 自动生成 RSS feed - 扫描 blog/ 目录所有文章
const fs = require('fs');
const path = require('path');

const regions = {
  anhui:'安徽', aomen:'澳门', beijing:'北京', chongqing:'重庆', fujian:'福建',
  gansu:'甘肃', guangdong:'广东', guangxi:'广西', guizhou:'贵州', hainan:'海南',
  hebei:'河北', heilongjiang:'黑龙江', henan:'河南', hubei:'湖北', hunan:'湖南',
  jiangsu:'江苏', jiangxi:'江西', jilin:'吉林', liaoning:'辽宁', neimenggu:'内蒙古',
  ningxia:'宁夏', qinghai:'青海', shaanxi:'陕西', shandong:'山东', shanghai:'上海',
  shanxi:'山西', sichuan:'四川', taiwan:'台湾', tianjin:'天津', xianggang:'香港',
  xinjiang:'新疆', xizang:'西藏', yunnan:'云南', zhejiang:'浙江',
  thailand:'泰国', vietnam:'越南', indonesia:'印度尼西亚', dubai:'迪拜'
};

const pubDate = new Date().toUTCString();
const items = [];

for (const key of Object.keys(regions).sort()) {
  const file = path.join('blog', `${key}.html`);
  if (!fs.existsSync(file)) continue;
  const c = fs.readFileSync(file, 'utf8');
  const titleMatch = c.match(/<title>([^<]+)<\/title>/);
  const descMatch = c.match(/meta name="description" content="([^"]+)"/);
  const title = (titleMatch?.[1] || '').replace(/ \| wedding-tv\.cn$/, '');
  const desc = descMatch?.[1] || '';
  items.push(`  <item>
    <title><![CDATA[${title}]]></title>
    <link>https://wedding-tv.cn/blog/${key}.html</link>
    <guid isPermaLink="true">https://wedding-tv.cn/blog/${key}.html</guid>
    <description><![CDATA[${desc}]]></description>
    <pubDate>${pubDate}</pubDate>
    <category>${regions[key]}婚俗</category>
  </item>`);
}

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>wedding-tv.cn — 中国34省婚俗大全</title>
  <link>https://wedding-tv.cn/</link>
  <atom:link href="https://wedding-tv.cn/rss.xml" rel="self" type="application/rss+xml" />
  <description>覆盖全国34个省/直辖市/自治区/特区的婚礼习俗完全指南</description>
  <language>zh-CN</language>
  <lastBuildDate>${pubDate}</lastBuildDate>
  <generator>wedding-tv.cn auto-rss</generator>
${items.join('\n')}
</channel>
</rss>
`;

fs.writeFileSync('rss.xml', rss, 'utf8');
console.log(`✓ rss.xml 已生成 (${items.length} items)`);
