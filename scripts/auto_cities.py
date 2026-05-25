#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 地级市婚俗页面自动生成器

流程：
  1. 从城市池中挑选未发布的城市（按周序号轮转）
  2. 调通义千问 qwen-plus-latest 生成 1800-2400 字本地婚俗指南（JSON）
  3. 渲染 blog/cities/<pinyin>.html（与省份页风格一致 + Article+FAQ Schema）
  4. 更新 sitemap.xml、blog/cities/index.html、rss.xml
  5. 写回 cities_state.json

环境变量：
  DASHSCOPE_API_KEY  通义千问 API Key（必需）
  MAX_CITIES         本次生成数量（默认 2）
"""
from __future__ import annotations

import json
import os
import re
import sys
import html
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CITIES_DIR = ROOT / "blog" / "cities"
SITEMAP = ROOT / "sitemap.xml"
STATE_FILE = ROOT / "scripts" / "cities_state.json"
BJ_TZ = timezone(timedelta(hours=8))
MAX_CITIES = int(os.environ.get("MAX_CITIES", "2"))

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rss_builder import build_rss  # noqa: E402

# 100 个有特色的中国地级市（中文, 拼音, 所属省份, 大区）
CITY_POOL: list[tuple[str, str, str, str]] = [
    # 华东
    ("合肥", "hefei", "安徽", "华东"), ("芜湖", "wuhu", "安徽", "华东"),
    ("黄山", "huangshan", "安徽", "华东"), ("苏州", "suzhou", "江苏", "华东"),
    ("南京", "nanjing", "江苏", "华东"), ("无锡", "wuxi", "江苏", "华东"),
    ("徐州", "xuzhou", "江苏", "华东"), ("扬州", "yangzhou", "江苏", "华东"),
    ("杭州", "hangzhou", "浙江", "华东"), ("宁波", "ningbo", "浙江", "华东"),
    ("温州", "wenzhou", "浙江", "华东"), ("绍兴", "shaoxing", "浙江", "华东"),
    ("嘉兴", "jiaxing", "浙江", "华东"), ("金华", "jinhua", "浙江", "华东"),
    ("福州", "fuzhou", "福建", "华东"), ("厦门", "xiamen", "福建", "华东"),
    ("泉州", "quanzhou", "福建", "华东"), ("漳州", "zhangzhou", "福建", "华东"),
    ("南昌", "nanchang", "江西", "华东"), ("赣州", "ganzhou", "江西", "华东"),
    ("济南", "jinan", "山东", "华东"), ("青岛", "qingdao", "山东", "华东"),
    ("烟台", "yantai", "山东", "华东"), ("潍坊", "weifang", "山东", "华东"),
    ("淄博", "zibo", "山东", "华东"), ("临沂", "linyi", "山东", "华东"),
    # 华北
    ("石家庄", "shijiazhuang", "河北", "华北"), ("唐山", "tangshan", "河北", "华北"),
    ("保定", "baoding", "河北", "华北"), ("承德", "chengde", "河北", "华北"),
    ("太原", "taiyuan", "山西", "华北"), ("大同", "datong", "山西", "华北"),
    ("平遥", "pingyao", "山西", "华北"), ("呼和浩特", "huhehaote", "内蒙古", "华北"),
    ("包头", "baotou", "内蒙古", "华北"),
    # 华中
    ("郑州", "zhengzhou", "河南", "华中"), ("洛阳", "luoyang", "河南", "华中"),
    ("开封", "kaifeng", "河南", "华中"), ("南阳", "nanyang", "河南", "华中"),
    ("武汉", "wuhan", "湖北", "华中"), ("宜昌", "yichang", "湖北", "华中"),
    ("襄阳", "xiangyang", "湖北", "华中"), ("长沙", "changsha", "湖南", "华中"),
    ("湘潭", "xiangtan", "湖南", "华中"), ("岳阳", "yueyang", "湖南", "华中"),
    ("常德", "changde", "湖南", "华中"),
    # 华南
    ("广州", "guangzhou", "广东", "华南"), ("深圳", "shenzhen", "广东", "华南"),
    ("珠海", "zhuhai", "广东", "华南"), ("佛山", "foshan", "广东", "华南"),
    ("东莞", "dongguan", "广东", "华南"), ("中山", "zhongshan", "广东", "华南"),
    ("惠州", "huizhou", "广东", "华南"), ("汕头", "shantou", "广东", "华南"),
    ("湛江", "zhanjiang", "广东", "华南"), ("梅州", "meizhou", "广东", "华南"),
    ("潮州", "chaozhou", "广东", "华南"), ("南宁", "nanning", "广西", "华南"),
    ("桂林", "guilin", "广西", "华南"), ("柳州", "liuzhou", "广西", "华南"),
    ("北海", "beihai", "广西", "华南"), ("海口", "haikou", "海南", "华南"),
    ("三亚", "sanya", "海南", "华南"),
    # 西南
    ("成都", "chengdu", "四川", "西南"), ("绵阳", "mianyang", "四川", "西南"),
    ("乐山", "leshan", "四川", "西南"), ("宜宾", "yibin", "四川", "西南"),
    ("德阳", "deyang", "四川", "西南"), ("贵阳", "guiyang", "贵州", "西南"),
    ("遵义", "zunyi", "贵州", "西南"), ("昆明", "kunming", "云南", "西南"),
    ("大理", "dali", "云南", "西南"), ("丽江", "lijiang", "云南", "西南"),
    ("西双版纳", "xishuangbanna", "云南", "西南"), ("拉萨", "lasa", "西藏", "西南"),
    # 西北
    ("西安", "xian", "陕西", "西北"), ("咸阳", "xianyang", "陕西", "西北"),
    ("延安", "yanan", "陕西", "西北"), ("宝鸡", "baoji", "陕西", "西北"),
    ("兰州", "lanzhou", "甘肃", "西北"), ("敦煌", "dunhuang", "甘肃", "西北"),
    ("银川", "yinchuan", "宁夏", "西北"), ("西宁", "xining", "青海", "西北"),
    ("乌鲁木齐", "wulumuqi", "新疆", "西北"), ("喀什", "kashi", "新疆", "西北"),
    ("吐鲁番", "tulufan", "新疆", "西北"),
    # 东北
    ("沈阳", "shenyang", "辽宁", "东北"), ("大连", "dalian", "辽宁", "东北"),
    ("鞍山", "anshan", "辽宁", "东北"), ("丹东", "dandong", "辽宁", "东北"),
    ("长春", "changchun", "吉林", "东北"), ("吉林市", "jilinshi", "吉林", "东北"),
    ("延边", "yanbian", "吉林", "东北"), ("哈尔滨", "haerbin", "黑龙江", "东北"),
    ("齐齐哈尔", "qiqihaer", "黑龙江", "东北"), ("大庆", "daqing", "黑龙江", "东北"),
]


def log(msg: str) -> None:
    print(f"[{datetime.now(BJ_TZ).strftime('%H:%M:%S')}] {msg}", flush=True)


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text("utf-8"))
        except Exception:
            pass
    return {"published": []}


def save_state(s: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(s, ensure_ascii=False, indent=2), "utf-8")


def pick_cities(state: dict, n: int) -> list[tuple[str, str, str, str]]:
    published = set(state.get("published", []))
    unused = [c for c in CITY_POOL if c[1] not in published]
    if not unused:
        return []
    return unused[:n]


def call_qwen(name: str, province: str, region: str) -> dict | None:
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        log("  ✗ 未配置 DASHSCOPE_API_KEY")
        return None
    try:
        from openai import OpenAI
    except ImportError:
        log("  ✗ openai 库未安装")
        return None
    client = OpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    system_prompt = (
        "你是 wedding-tv.cn 婚俗研究编辑，专长撰写各地市婚俗本地化指南。"
        f"请围绕用户给的地级市，撰写一篇 1800-2400 字的本地婚俗指南。\n"
        "硬性要求：\n"
        "1. 标题：必须含市名 + 婚俗/婚礼字样，不超过 32 字\n"
        "2. 摘要：80-120 字，点出该城市婚俗 3 个鲜明特色\n"
        "3. 正文：必须 6-8 个二级标题，每段 250-380 字，本地化（提到本市方言/菜肴/景点/婚俗细节）\n"
        "4. 推荐标题方向（可调整顺序）：本地婚俗特色 / 提亲订婚 / 彩礼现状 / 迎亲流程 / 婚宴菜肴 / 当代新趋势 / 推荐婚礼场地或目的地\n"
        "5. 给出 5 道本地特色 FAQ（含本地彩礼区间、本地婚宴均价、本地热门婚礼酒店举例）\n"
        "6. 结尾段引导使用 wedding-tv.cn 工具\n"
        "7. 文风：信息密度高、有本地温度、不空话；不编造未经证实的具体酒店报价（区间即可）\n"
        "8. 输出严格 JSON（不要 markdown 包裹）：\n"
        '{"title":"...","summary":"...","keywords":["...",...],'
        '"fact":{"price_ceremony":"...","price_banquet":"...","specialty_dish":"...","venue_type":"..."},'
        '"sections":[{"h2":"...","content":"..."},...],'
        '"faq":[{"q":"...","a":"..."},...5个...]}'
    )
    user_prompt = f"地级市：{name}\n所属省份：{province}\n所在大区：{region}\n请生成本地婚俗完全指南。"
    try:
        resp = client.chat.completions.create(
            model="qwen-plus-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.75,
            response_format={"type": "json_object"},
            timeout=90,
        )
        raw = resp.choices[0].message.content or ""
        data = json.loads(raw)
        if not data.get("title") or len(data.get("sections", [])) < 5:
            log(f"  ✗ AI 返回不达标")
            return None
        return data
    except Exception as e:
        log(f"  ✗ AI 调用失败：{e}")
        return None


PAGE_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title_esc} | wedding-tv.cn</title>
<meta name="description" content="{summary_esc}" />
<meta name="keywords" content="{keywords_csv}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://wedding-tv.cn/blog/cities/{slug}.html" />
<meta property="og:title" content="{title_esc}" />
<meta property="og:description" content="{summary_esc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://wedding-tv.cn/blog/cities/{slug}.html" />
<meta property="og:image" content="https://wedding-tv.cn/og.png" />
<meta name="theme-color" content="#0e0a14" />
<meta name="google-adsense-account" content="ca-pub-6560247681968502" />
<script async fetchpriority="low" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>🏙️</text></svg>" />
<script type="application/ld+json">
{article_ld}
</script>
{faq_ld_block}
<style>
:root{{--bg:#0e0a14;--fg:#f5f1ea;--mute:#b9b1a3;--accent:#d4a574;--card:#1a1320;--line:#2a2030}}
*{{box-sizing:border-box}}
body{{margin:0;font:16px/1.85 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg)}}
a{{color:var(--accent);text-decoration:none}}a:hover{{text-decoration:underline}}
header.topbar{{border-bottom:1px solid var(--line);background:#0a060f;position:sticky;top:0;z-index:5}}
header.topbar .inner{{max-width:780px;margin:0 auto;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}}
header.topbar a.brand{{font-weight:700;color:var(--fg)}}
nav a{{margin-left:14px;color:var(--mute);font-size:13px}}
.wrap{{max-width:780px;margin:0 auto;padding:36px 22px}}
.crumbs{{font-size:13px;color:var(--mute);margin-bottom:14px}}
h1{{font-size:28px;margin:0 0 12px;line-height:1.35}}
.meta{{color:var(--mute);font-size:13px;margin-bottom:24px;border-bottom:1px solid var(--line);padding-bottom:18px}}
.meta span{{margin-right:14px}}
h2{{font-size:21px;margin:32px 0 12px;color:var(--accent);border-left:4px solid var(--accent);padding-left:12px}}
.intro{{font-size:16px;color:#e8dfca;background:rgba(212,165,116,.06);padding:16px 18px;border-radius:8px;border-left:3px solid var(--accent)}}
.fact-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0;background:var(--card);border-radius:10px;padding:18px;border:1px solid var(--line)}}
.fact-grid div{{font-size:13px}}
.fact-grid strong{{color:var(--accent);display:block;margin-bottom:4px;font-size:12px;letter-spacing:1px}}
.faq-section{{margin:40px 0 24px;padding:24px;background:var(--card);border:1px solid var(--line);border-radius:12px}}
.faq-section details{{margin:14px 0;padding:12px 14px;background:#0e0a14;border-radius:8px;border:1px solid var(--line)}}
.faq-section summary{{cursor:pointer;font-weight:600;color:var(--accent)}}
.cta{{background:linear-gradient(135deg,rgba(212,165,116,.12),var(--card));border:1px solid var(--accent);border-radius:12px;padding:20px;margin:32px 0}}
.cta h3{{margin:0 0 8px;color:var(--accent)}}
.cta a{{display:inline-block;margin:6px 6px 0 0;padding:6px 12px;background:#0e0a14;border:1px solid var(--line);border-radius:6px;font-size:13px}}
.related{{margin-top:36px;padding-top:24px;border-top:1px solid var(--line)}}
footer{{border-top:1px solid var(--line);margin-top:48px;padding:24px 22px;color:var(--mute);font-size:13px;text-align:center}}
</style>
</head>
<body>
<header class="topbar">
  <div class="inner">
    <a class="brand" href="/">wedding-tv.cn</a>
    <nav>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/blog/cities/">🏙️ 地级市</a>
      <a href="/almanac.html">📅 吉日</a>
    </nav>
  </div>
</header>
<main class="wrap">
<div class="crumbs"><a href="/">首页</a> · <a href="/blog.html">博客</a> · <a href="/blog/cities/">地级市婚俗</a> · <a href="/blog/{province_pinyin}.html">{province}</a> · {city}</div>
<h1>{title_esc}</h1>
<div class="meta"><span>🏙️ {city}（{province}·{region}）</span><span>🗓️ 更新：{date_str}</span><span>📖 阅读约 {read_min} 分钟</span></div>
<p class="intro">{summary_esc}</p>
{fact_html}
{sections_html}
{faq_html}
<div class="cta">
  <h3>🎁 在{city}办婚礼？这些免费工具用得上</h3>
  <p style="margin:0 0 8px;color:var(--mute);font-size:14px">由 wedding-tv.cn 提供，无需注册：</p>
  <a href="/almanac.html">📅 婚期吉日</a>
  <a href="/calculator.html">💰 预算计算</a>
  <a href="/budget-reference.html">🏙️ 城市预算库</a>
  <a href="/invitation.html">💌 电子请帖</a>
  <a href="/timeline.html">⏱️ 流程时间轴</a>
  <a href="/vows.html">💍 AI 誓词</a>
  <a href="/speech.html">🎤 AI 致辞</a>
  <a href="/checklist.html">📋 筹备清单</a>
</div>
<div class="related">
  <h3 style="font-size:16px;color:var(--accent)">📍 同区域婚俗推荐</h3>
  <a href="/blog/{province_pinyin}.html" style="display:block;padding:8px 0;border-bottom:1px solid var(--line);color:var(--fg);font-size:14px">📍 {province} 全省婚俗指南 →</a>
  <a href="/blog/cities/" style="display:block;padding:8px 0;border-bottom:1px solid var(--line);color:var(--fg);font-size:14px">🏙️ 查看全部地级市婚俗 →</a>
  <a href="/blog.html#regions" style="display:block;padding:8px 0;color:var(--fg);font-size:14px">🗺️ 全国 34 省婚俗大全 →</a>
</div>
</main>
<footer>© wedding-tv.cn · <a href="/privacy.html">隐私</a> · <a href="/terms.html">条款</a> · <a href="/about.html">关于</a> · <a href="/sitemap.xml">Sitemap</a></footer>
<script>
(function(){{var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?1df8fda3d25e8df34a5c8e08f945e9fb";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);}})();
if("serviceWorker" in navigator){{window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{{}}))}}
</script>
</body>
</html>
"""


def esc(s: str) -> str:
    return html.escape(s or "", quote=True)


# 省份中文 -> 拼音映射（保证 crumb 链接可用）
PROVINCE_PINYIN = {
    "安徽": "anhui", "江苏": "jiangsu", "浙江": "zhejiang", "福建": "fujian",
    "江西": "jiangxi", "山东": "shandong", "河北": "hebei", "山西": "shanxi",
    "内蒙古": "neimenggu", "河南": "henan", "湖北": "hubei", "湖南": "hunan",
    "广东": "guangdong", "广西": "guangxi", "海南": "hainan", "四川": "sichuan",
    "贵州": "guizhou", "云南": "yunnan", "西藏": "xizang", "陕西": "shaanxi",
    "甘肃": "gansu", "宁夏": "ningxia", "青海": "qinghai", "新疆": "xinjiang",
    "辽宁": "liaoning", "吉林": "jilin", "黑龙江": "heilongjiang",
}

BLOG_HTML = ROOT / "blog.html"

# 各大区对应其后一个 zone-id（用于找插入锚点）
ZONE_NEXT = {
    "华北": "zone-dongbei",
    "东北": "zone-huadong",
    "华东": "zone-huazhong",
    "华中": "zone-huanan",
    "华南": "zone-xinan",
    "西南": "zone-xibei",
    "西北": None,  # 最后一区，插到 grid 结束前
}


def inject_city_to_blog_html(city: str, pinyin: str, province: str, region: str, summary: str) -> None:
    """把城市卡片注入 blog.html 对应大区末尾，并更新文章计数。"""
    if not BLOG_HTML.exists():
        return
    content = BLOG_HTML.read_text("utf-8")

    city_url = f"/blog/cities/{pinyin}.html"
    if city_url in content:
        log(f"  ℹ  {city} 已在 blog.html 中，跳过")
        return

    # 截取摘要（不超过 45 字）
    short = summary[:45].rstrip("，。；：、") if summary else f"{province}地级市婚俗"
    card = (
        f'  <a class="card" href="{city_url}">'
        f'<span class="tag">{html.escape(region)}</span>'
        f'<h3>🏙️ {html.escape(city)}婚俗</h3>'
        f'<p>{html.escape(province)}·地级市 | {html.escape(short)}…</p>'
        f'<span class="go">阅读 →</span></a>\n'
    )

    next_zone = ZONE_NEXT.get(region)
    if next_zone:
        anchor = f'  <h3 id="{next_zone}"'
        if anchor not in content:
            log(f"  ⚠  未找到 {next_zone} 锚点，跳过注入")
            return
        content = content.replace(anchor, card + anchor, 1)
    else:
        # 西北是最后一区，插到 </div> 紧接 <!-- AdSense 之前
        anchor = '</div>\n<!-- AdSense ad2'
        if anchor not in content:
            anchor = '</div>\n\n<h2 id="international"'
        if anchor not in content:
            log("  ⚠  未找到西北区结束锚点，跳过注入")
            return
        content = content.replace(anchor, card + anchor, 1)

    # 更新 h2 计数：城市文件总数（排除 index.html）
    city_count = len([f for f in CITIES_DIR.glob("*.html") if f.name != "index.html"])
    content = re.sub(
        r'各地婚俗大全（34[^）]*）',
        f'各地婚俗大全（34 省 + {city_count} 地级市）',
        content,
    )

    BLOG_HTML.write_text(content, "utf-8")
    log(f"  ✓ blog.html 注入 {city}（{region}）并更新计数为 {city_count}")


def render(article: dict, city: str, province: str, region: str, slug: str, pub_dt: datetime) -> str:
    title = article["title"].strip()
    summary = (article.get("summary") or "").strip()
    keywords = article.get("keywords") or []
    sections = article.get("sections") or []
    faq = article.get("faq") or []
    fact = article.get("fact") or {}

    parts = []
    total_text = summary
    for sec in sections:
        h2 = (sec.get("h2") or "").strip()
        content = (sec.get("content") or "").strip()
        if not h2 or not content:
            continue
        paras = [p.strip() for p in re.split(r"\n{2,}|\r\n\r\n", content) if p.strip()] or [content]
        body = "\n".join(f"<p>{esc(p)}</p>" for p in paras)
        parts.append(f'<h2>{esc(h2)}</h2>\n{body}')
        total_text += content
    sections_html = "\n".join(parts)

    fact_html = ""
    if fact:
        items = [
            ("🎁 典礼/订婚成本", fact.get("price_ceremony", "")),
            ("🍽️ 婚宴桌价区间", fact.get("price_banquet", "")),
            ("🥢 本地特色菜", fact.get("specialty_dish", "")),
            ("🏛️ 推荐场地类型", fact.get("venue_type", "")),
        ]
        cards = "".join(
            f"<div><strong>{esc(k)}</strong>{esc(str(v))}</div>"
            for k, v in items if v
        )
        if cards:
            fact_html = f'<div class="fact-grid">{cards}</div>'

    faq_html = ""
    faq_ld_block = ""
    if faq:
        items, ld_main = [], []
        for qa in faq[:5]:
            q = (qa.get("q") or "").strip()
            a = (qa.get("a") or "").strip()
            if not q or not a:
                continue
            items.append(
                f'  <details>\n    <summary>{esc(q)}</summary>\n'
                f'    <p style="margin:10px 0 0;line-height:1.85">{esc(a)}</p>\n  </details>'
            )
            ld_main.append({
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            })
        if items:
            faq_html = (
                f'<section class="faq-section">\n'
                f'  <h2 style="margin-top:0;border:none;padding:0">❓ {esc(city)}婚礼常见问题</h2>\n'
                + "\n".join(items) + "\n</section>"
            )
            faq_ld_block = (
                '<script type="application/ld+json">\n'
                + json.dumps(
                    {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": ld_main},
                    ensure_ascii=False,
                ) + "\n</script>"
            )

    article_ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": summary,
        "author": {"@type": "Organization", "name": "wedding-tv.cn"},
        "publisher": {"@type": "Organization", "name": "wedding-tv.cn", "url": "https://wedding-tv.cn/"},
        "datePublished": pub_dt.isoformat(),
        "dateModified": pub_dt.isoformat(),
        "mainEntityOfPage": f"https://wedding-tv.cn/blog/cities/{slug}.html",
        "image": "https://wedding-tv.cn/og.png",
        "keywords": ",".join(keywords),
        "articleSection": f"{region}·{province}·{city}",
    }, ensure_ascii=False)

    read_min = max(3, len(total_text) // 400)
    province_pinyin = PROVINCE_PINYIN.get(province, "")

    return PAGE_TEMPLATE.format(
        title_esc=esc(title),
        summary_esc=esc(summary),
        keywords_csv=esc(",".join(keywords + [f"{city}婚俗", f"{city}婚礼", f"{province}婚俗", "wedding-tv.cn"])),
        slug=slug,
        article_ld=article_ld,
        faq_ld_block=faq_ld_block,
        city=esc(city),
        province=esc(province),
        province_pinyin=province_pinyin,
        region=esc(region),
        date_str=pub_dt.strftime("%Y-%m-%d"),
        read_min=read_min,
        fact_html=fact_html,
        sections_html=sections_html,
        faq_html=faq_html,
    )


INDEX_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>地级市婚俗大全 | wedding-tv.cn</title>
<meta name="description" content="wedding-tv.cn 中国 100+ 地级市婚俗指南：本地特色、彩礼区间、婚宴菜肴、流程礼节，每日新增。" />
<meta name="keywords" content="地级市婚俗,城市婚礼,本地婚俗,中国婚俗,wedding-tv.cn" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://wedding-tv.cn/blog/cities/" />
<meta name="theme-color" content="#0e0a14" />
<meta name="google-adsense-account" content="ca-pub-6560247681968502" />
<script async fetchpriority="low" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>🏙️</text></svg>" />
<style>
:root{{--bg:#0e0a14;--fg:#f5f1ea;--mute:#b9b1a3;--accent:#d4a574;--card:#1a1320;--line:#2a2030}}
*{{box-sizing:border-box}}body{{margin:0;font:16px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg)}}
a{{color:var(--accent);text-decoration:none}}a:hover{{text-decoration:underline}}
header.topbar{{border-bottom:1px solid var(--line);background:#0a060f;position:sticky;top:0;z-index:5}}
header.topbar .inner{{max-width:980px;margin:0 auto;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}}
header.topbar a.brand{{font-weight:700;color:var(--fg)}}
nav a{{margin-left:14px;color:var(--mute);font-size:13px}}
.wrap{{max-width:980px;margin:0 auto;padding:32px 22px}}
h1{{font-size:28px;margin:0 0 8px}}
.lead{{color:var(--mute);margin-bottom:24px}}
.region{{margin:28px 0 8px;color:var(--accent);font-size:18px;border-left:4px solid var(--accent);padding-left:12px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:16px}}
.card{{display:block;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px;color:var(--fg);font-size:14px;transition:.2s}}
.card:hover{{border-color:var(--accent);text-decoration:none;transform:translateY(-1px)}}
.card .c{{font-weight:600;color:var(--fg)}}
.card .p{{font-size:12px;color:var(--mute);margin-top:4px}}
footer{{border-top:1px solid var(--line);margin-top:48px;padding:24px 22px;color:var(--mute);font-size:13px;text-align:center}}
</style>
</head>
<body>
<header class="topbar">
  <div class="inner">
    <a class="brand" href="/">wedding-tv.cn</a>
    <nav>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/blog/cities/">🏙️ 地级市</a>
      <a href="/news/">📰 资讯</a>
      <a href="/insights/">📊 洞察</a>
    </nav>
  </div>
</header>
<main class="wrap">
<h1>🏙️ 中国地级市婚俗大全</h1>
<p class="lead">本地化婚俗指南，覆盖 100+ 个地级市的特色礼俗、彩礼区间、婚宴菜肴、推荐场地。已收录 <strong>{total}</strong> 个城市，每日自动新增。</p>
{regions_html}
</main>
<footer>© wedding-tv.cn · <a href="/privacy.html">隐私</a> · <a href="/terms.html">条款</a> · <a href="/about.html">关于</a> · <a href="/sitemap.xml">Sitemap</a></footer>
</body>
</html>
"""


def rebuild_index() -> None:
    CITIES_DIR.mkdir(parents=True, exist_ok=True)
    published_set = set()
    for f in CITIES_DIR.glob("*.html"):
        if f.name == "index.html":
            continue
        published_set.add(f.stem)

    # 按大区分组
    by_region: dict[str, list[tuple[str, str, str]]] = {}
    for city, pinyin, province, region in CITY_POOL:
        if pinyin in published_set:
            by_region.setdefault(region, []).append((city, pinyin, province))

    region_order = ["华东", "华北", "华中", "华南", "西南", "西北", "东北"]
    blocks = []
    for r in region_order:
        cities = by_region.get(r, [])
        if not cities:
            continue
        cards = "".join(
            f'<a class="card" href="/blog/cities/{p}.html"><div class="c">📍 {esc(c)}</div><div class="p">{esc(prov)}</div></a>'
            for c, p, prov in cities
        )
        blocks.append(f'<div class="region">{r}（{len(cities)} 城）</div>\n<div class="grid">{cards}</div>')
    regions_html = "\n".join(blocks) or '<p style="color:#b9b1a3">首批城市生成中…</p>'

    (CITIES_DIR / "index.html").write_text(
        INDEX_TEMPLATE.format(total=len(published_set), regions_html=regions_html),
        "utf-8",
    )
    log(f"  ✓ blog/cities/index.html（{len(published_set)} 城）")


def update_sitemap(slugs: list[str], pub_date: str) -> None:
    if not slugs or not SITEMAP.exists():
        return
    xml = SITEMAP.read_text("utf-8")
    if "https://wedding-tv.cn/blog/cities/</loc>" not in xml:
        xml = xml.replace(
            "</urlset>",
            "  <url>\n"
            "    <loc>https://wedding-tv.cn/blog/cities/</loc>\n"
            f"    <lastmod>{pub_date}</lastmod>\n"
            "    <changefreq>daily</changefreq>\n"
            "    <priority>0.85</priority>\n"
            "  </url>\n</urlset>",
        )
    for slug in slugs:
        url = f"https://wedding-tv.cn/blog/cities/{slug}.html"
        if url in xml:
            continue
        xml = xml.replace(
            "</urlset>",
            "  <url>\n"
            f"    <loc>{url}</loc>\n"
            f"    <lastmod>{pub_date}</lastmod>\n"
            "    <changefreq>yearly</changefreq>\n"
            "    <priority>0.75</priority>\n"
            "  </url>\n</urlset>",
        )

    # 刷新核心索引页 lastmod，提升抓取时效信号
    for loc in [
        "https://wedding-tv.cn/blog/cities/",
        "https://wedding-tv.cn/blog.html",
    ]:
        xml = re.sub(
            rf"(<loc>{re.escape(loc)}</loc>\s*<lastmod>)([^<]+)(</lastmod>)",
            rf"\g<1>{pub_date}\g<3>",
            xml,
            count=1,
        )

    SITEMAP.write_text(xml, "utf-8")
    log(f"  ✓ sitemap.xml 已写入 {len(slugs)} 条")


def main() -> int:
    log(f"启动地级市婚俗生成器（本次最多 {MAX_CITIES} 个）")
    if not os.environ.get("DASHSCOPE_API_KEY"):
        log("⚠️ 未配置 DASHSCOPE_API_KEY")
        return 0
    CITIES_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()
    targets = pick_cities(state, MAX_CITIES)
    if not targets:
        log("所有地级市已覆盖，退出")
        return 0

    pub_dt = datetime.now(BJ_TZ)
    pub_date_str = pub_dt.strftime("%Y-%m-%d")
    new_slugs: list[str] = []
    for city, pinyin, province, region in targets:
        log(f"生成中：{city}（{province}·{region}）")
        article = call_qwen(city, province, region)
        if not article:
            continue
        out = CITIES_DIR / f"{pinyin}.html"
        out.write_text(render(article, city, province, region, pinyin, pub_dt), "utf-8")
        state.setdefault("published", []).append(pinyin)
        new_slugs.append(pinyin)
        inject_city_to_blog_html(city, pinyin, province, region, article.get("summary", ""))
        log(f"  ✓ 已保存 blog/cities/{pinyin}.html")

    if not new_slugs:
        log("本轮没有生成任何文章")
        return 0

    save_state(state)
    update_sitemap(new_slugs, pub_date_str)
    rebuild_index()
    try:
        n = build_rss()
        log(f"  ✓ rss.xml 重建（{n} 条）")
    except Exception as e:
        log(f"  ⚠ rss 重建失败：{e}")
    log(f"完成：本次生成 {len(new_slugs)} 篇")
    return 0


if __name__ == "__main__":
    sys.exit(main())
