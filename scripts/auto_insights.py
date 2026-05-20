#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 每周行业洞察长文自动生成器

流程：
  1. 从预定义主题池中随机/轮转选 1 个本周未发布主题
  2. 调通义千问 qwen-plus-latest 生成 4000-5000 字深度长文（JSON）
  3. 渲染为 insights/YYYYMMDD-slug.html（与站点风格一致 + Article Schema）
  4. 更新 sitemap.xml、insights/index.html、rss.xml
  5. 写回 insights_state.json

环境变量：
  DASHSCOPE_API_KEY  通义千问 API Key（必需）
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import html
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INSIGHTS_DIR = ROOT / "insights"
SITEMAP = ROOT / "sitemap.xml"
STATE_FILE = ROOT / "scripts" / "insights_state.json"
BJ_TZ = timezone(timedelta(hours=8))

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rss_builder import build_rss  # noqa: E402

# 主题池：30 个深度选题，覆盖 1 年（每周一个，循环 ≈30 周后会复用但都会带年份）
TOPIC_POOL = [
    "2026 中式婚礼回潮十大趋势：从凤冠霞帔到秀禾簪花",
    "Z 世代婚礼：00 后新人重新定义的 8 大婚俗",
    "婚礼极简主义浪潮：为什么越来越多新人选择“30 人小婚礼”",
    "中国婚庆产业 2026 全景：万亿市场背后的 5 大变局",
    "AI 如何彻底改变婚礼筹备：从誓词到流程的全链路革命",
    "目的地婚礼爆发：大理、三亚、长滩岛热门目的地深度对比",
    "彩礼新观察：2026 各省彩礼地图与年轻人的应对策略",
    "婚礼摄影 2026 趋势：胶片复古、纪实风、AI 修图全解析",
    "婚宴成本拆解：从 8 万到 80 万，钱到底花在了哪里",
    "婚礼策划师消亡论？AI + 模板会让传统婚庆人下岗吗",
    "电子请帖完全替代纸质请帖？一线城市数据告诉你答案",
    "婚礼司仪行业变革：内容型主持人崛起与传统报幕式没落",
    "新中式婚礼 vs 传统中式 vs 西式婚礼：选择困境与解法",
    "婚纱礼服租赁市场崛起：5000 元穿大牌的“圆梦”经济",
    "婚礼花艺成本下降 60%？仿真花、租赁花艺、永生花新格局",
    "婚礼伴手礼内卷：从喜糖到联名礼盒的 7 个进化阶段",
    "蜜月旅行 2026 报告：年轻人最爱的 20 个目的地与避坑指南",
    "婚检 vs 婚前协议：法律层面新人最该关心的 5 件事",
    "二婚市场观察：再婚率连续 5 年上升背后的社会动因",
    "晚婚晚育时代：30+ 新娘的婚礼筹备与心态调适",
    "异地恋婚礼操盘指南：双城 / 跨国 / 跨省的 3 套方案",
    "婚礼直播 + 元宇宙婚礼：让远方亲友“在场”的技术方案",
    "中式婚礼必懂的 10 个传统礼制：六礼、三书、合卺、却扇",
    "宋制婚礼火爆出圈：典礼复原、服饰考据、流程详解",
    "明制婚礼 vs 唐制婚礼 vs 汉制婚礼：选哪种最适合你",
    "婚礼歌单进化史：从《婚礼进行曲》到 AI 定制 BGM",
    "婚礼餐饮趋势：分餐制、轻食化、八大菜系融合方案",
    "婚礼回礼经济学：互换型 / 答谢型 / 投资型回礼对比",
    "婚礼数字化档案：电子相册、区块链证书、AI 婚礼影像",
    "DINK / 不婚主义 / 同居伴侣：2026 新型亲密关系图谱",
]


def log(msg: str) -> None:
    print(f"[{datetime.now(BJ_TZ).strftime('%H:%M:%S')}] {msg}", flush=True)


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text("utf-8"))
        except Exception:
            pass
    return {"published_topics": []}


def save_state(s: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(s, ensure_ascii=False, indent=2), "utf-8")


def pick_topic(state: dict) -> str | None:
    published = set(state.get("published_topics", []))
    unused = [t for t in TOPIC_POOL if t not in published]
    if unused:
        # 用周序号取模选，保证每周稳定可复现
        idx = datetime.now(BJ_TZ).isocalendar().week % len(unused)
        return unused[idx]
    # 全部用过，重置
    state["published_topics"] = []
    return TOPIC_POOL[0]


def call_qwen(topic: str) -> dict | None:
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
        "你是 wedding-tv.cn 资深行业研究员，专注婚礼/婚庆/婚恋产业研究。"
        "请围绕用户给的选题，撰写一篇 4000-5000 字的深度行业洞察长文。\n"
        "硬性要求：\n"
        "1. 标题：含年份 2026、专业、不超过 35 字\n"
        "2. 摘要：120 字内，点明 3 个核心论点\n"
        "3. 正文：必须 8-10 个二级标题（h2），每段 400-550 字\n"
        "4. 每个 h2 段落必须包含：观察现象 / 数据或案例 / 行业解读 / 趋势研判 至少 3 项\n"
        "5. 数据须标注合理来源类型（如：行业白皮书、问卷调研、平台公开数据），不强求真实出处\n"
        "6. 结尾段引导读者使用 wedding-tv.cn 的预算计算器/吉日查询/电子请帖/AI 工具\n"
        "7. 文风：客观、专业、有数据支撑，避免空话套话；不出现广告夸张语\n"
        "8. 不得编造未经证实的明星隐私 / 公司丑闻 / 政策法规\n"
        "9. 输出严格 JSON（不要 markdown 包裹）。结构：\n"
        '{"title":"...","summary":"...","keywords":["...",...],'
        '"sections":[{"h2":"...","content":"...(400-550字)..."},...8-10个...],'
        '"faq":[{"q":"...","a":"..."},...5个...]}'
    )
    user_prompt = f"选题：{topic}\n请生成完整深度长文。"
    try:
        resp = client.chat.completions.create(
            model="qwen-plus-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
            timeout=180,
        )
        raw = resp.choices[0].message.content or ""
        data = json.loads(raw)
        if not data.get("title") or len(data.get("sections", [])) < 6:
            log(f"  ✗ AI 返回不达标（sections={len(data.get('sections', []))}）")
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
<title>{title_esc} | wedding-tv.cn 行业洞察</title>
<meta name="description" content="{summary_esc}" />
<meta name="keywords" content="{keywords_csv}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://wedding-tv.cn/insights/{slug}.html" />
<meta property="og:title" content="{title_esc}" />
<meta property="og:description" content="{summary_esc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://wedding-tv.cn/insights/{slug}.html" />
<meta property="og:image" content="https://wedding-tv.cn/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#0e0a14" />
<meta name="google-adsense-account" content="ca-pub-6560247681968502" />
<script async fetchpriority="low" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>📊</text></svg>" />
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
header.topbar .inner{{max-width:820px;margin:0 auto;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}}
header.topbar a.brand{{font-weight:700;color:var(--fg)}}
nav a{{margin-left:14px;color:var(--mute);font-size:13px}}
.wrap{{max-width:820px;margin:0 auto;padding:36px 22px}}
.crumbs{{font-size:13px;color:var(--mute);margin-bottom:14px}}
.badge{{display:inline-block;background:var(--accent);color:#0e0a14;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;margin-right:8px;vertical-align:middle}}
h1{{font-size:30px;margin:0 0 12px;line-height:1.35}}
.meta{{color:var(--mute);font-size:13px;margin-bottom:24px;border-bottom:1px solid var(--line);padding-bottom:18px}}
.meta span{{margin-right:14px}}
.toc{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 22px;margin:24px 0 32px;font-size:14px}}
.toc h3{{margin:0 0 8px;font-size:14px;color:var(--accent)}}
.toc ol{{margin:0;padding-left:22px;color:var(--mute);line-height:1.9}}
h2{{font-size:22px;margin:36px 0 12px;color:var(--accent);border-left:4px solid var(--accent);padding-left:12px;scroll-margin-top:80px}}
p{{margin:14px 0}}
.intro{{font-size:16px;color:#e8dfca;background:rgba(212,165,116,.06);padding:18px 20px;border-radius:8px;border-left:3px solid var(--accent)}}
.faq-section{{margin:48px 0 24px;padding:24px;background:var(--card);border:1px solid var(--line);border-radius:12px}}
.faq-section details{{margin:14px 0;padding:12px 14px;background:#0e0a14;border-radius:8px;border:1px solid var(--line)}}
.faq-section summary{{cursor:pointer;font-weight:600;color:var(--accent)}}
.cta{{background:linear-gradient(135deg,rgba(212,165,116,.12),var(--card));border:1px solid var(--accent);border-radius:12px;padding:22px;margin:36px 0}}
.cta h3{{margin:0 0 8px;color:var(--accent)}}
.cta a{{display:inline-block;margin:6px 6px 0 0;padding:6px 12px;background:#0e0a14;border:1px solid var(--line);border-radius:6px;font-size:13px}}
.disclaimer{{font-size:12px;color:var(--mute);margin-top:36px;padding-top:18px;border-top:1px dashed var(--line);line-height:1.7}}
footer{{border-top:1px solid var(--line);margin-top:48px;padding:24px 22px;color:var(--mute);font-size:13px;text-align:center}}
</style>
</head>
<body>
<header class="topbar">
  <div class="inner">
    <a class="brand" href="/">wedding-tv.cn</a>
    <nav>
      <a href="/">首页</a>
      <a href="/news/">📰 资讯</a>
      <a href="/insights/">📊 洞察</a>
      <a href="/blog.html">博客</a>
    </nav>
  </div>
</header>
<main class="wrap">
<div class="crumbs"><a href="/">首页</a> · <a href="/insights/">行业洞察</a> · 当前文章</div>
<h1><span class="badge">深度</span>{title_esc}</h1>
<div class="meta"><span>📊 wedding-tv.cn 研究组</span><span>🗓️ {date_str}</span><span>📖 阅读约 {read_min} 分钟 · {word_count} 字</span></div>
<p class="intro">{summary_esc}</p>
<div class="toc"><h3>📑 目录</h3><ol>{toc_html}</ol></div>
{sections_html}
{faq_html}
<div class="cta">
  <h3>🎁 wedding-tv.cn 婚礼筹备免费工具</h3>
  <p style="margin:0 0 8px;color:var(--mute);font-size:14px">配套使用，提升筹备效率：</p>
  <a href="/almanac.html">📅 婚期吉日</a>
  <a href="/calculator.html">💰 预算计算</a>
  <a href="/budget-reference.html">🏙️ 城市预算库</a>
  <a href="/invitation.html">💌 电子请帖</a>
  <a href="/timeline.html">⏱️ 流程时间轴</a>
  <a href="/timeline-templates.html">🗂️ 流程模板</a>
  <a href="/vows.html">💍 AI 誓词</a>
  <a href="/speech.html">🎤 AI 致辞</a>
  <a href="/checklist.html">📋 筹备清单</a>
</div>
<p class="disclaimer">📌 本文由 wedding-tv.cn 行业研究组基于公开资料、行业访谈、AI 辅助分析整理。文中数据为研判性观点，仅供参考，不构成投资建议。如发现引用偏差，请通过 <a href="/about.html">关于页</a> 反馈。</p>
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


def render(article: dict, slug: str, pub_dt: datetime) -> str:
    title = article["title"].strip()
    summary = (article.get("summary") or "").strip()
    keywords = article.get("keywords") or []
    sections = article.get("sections") or []
    faq = article.get("faq") or []

    parts = []
    toc_items = []
    total_text = summary
    for i, sec in enumerate(sections, 1):
        h2 = (sec.get("h2") or "").strip()
        content = (sec.get("content") or "").strip()
        if not h2 or not content:
            continue
        anchor = f"sec{i}"
        toc_items.append(f'<li><a href="#{anchor}">{esc(h2)}</a></li>')
        paras = [p.strip() for p in re.split(r"\n{2,}|\r\n\r\n", content) if p.strip()]
        if not paras:
            paras = [content]
        body = "\n".join(f"<p>{esc(p)}</p>" for p in paras)
        parts.append(f'<h2 id="{anchor}">{esc(h2)}</h2>\n{body}')
        total_text += content
    sections_html = "\n".join(parts)
    toc_html = "\n".join(toc_items)

    faq_html = ""
    faq_ld_block = ""
    if faq:
        items, ld_main = [], []
        for qa in faq[:6]:
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
                '<section class="faq-section">\n'
                '  <h2 style="margin-top:0;border:none;padding:0" id="faq">❓ 常见问题解答</h2>\n'
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
        "author": {"@type": "Organization", "name": "wedding-tv.cn 行业研究组"},
        "publisher": {"@type": "Organization", "name": "wedding-tv.cn", "url": "https://wedding-tv.cn/"},
        "datePublished": pub_dt.isoformat(),
        "dateModified": pub_dt.isoformat(),
        "mainEntityOfPage": f"https://wedding-tv.cn/insights/{slug}.html",
        "image": "https://wedding-tv.cn/og.png",
        "keywords": ",".join(keywords),
        "articleSection": "行业洞察",
        "wordCount": len(total_text),
    }, ensure_ascii=False)

    word_count = len(total_text)
    read_min = max(5, word_count // 400)

    return PAGE_TEMPLATE.format(
        title_esc=esc(title),
        summary_esc=esc(summary),
        keywords_csv=esc(",".join(keywords + ["婚礼行业", "婚庆趋势", "wedding-tv.cn"])),
        slug=slug,
        article_ld=article_ld,
        faq_ld_block=faq_ld_block,
        date_str=pub_dt.strftime("%Y-%m-%d"),
        word_count=word_count,
        read_min=read_min,
        toc_html=toc_html,
        sections_html=sections_html,
        faq_html=faq_html,
    )


INDEX_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>婚礼行业洞察 | wedding-tv.cn</title>
<meta name="description" content="wedding-tv.cn 行业研究组出品的婚礼 / 婚庆 / 婚恋深度洞察长文，每周更新。" />
<meta name="keywords" content="婚礼行业,婚庆趋势,婚礼洞察,婚礼研究,wedding insights" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://wedding-tv.cn/insights/" />
<meta name="theme-color" content="#0e0a14" />
<meta name="google-adsense-account" content="ca-pub-6560247681968502" />
<script async fetchpriority="low" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>📊</text></svg>" />
<style>
:root{{--bg:#0e0a14;--fg:#f5f1ea;--mute:#b9b1a3;--accent:#d4a574;--card:#1a1320;--line:#2a2030}}
*{{box-sizing:border-box}}body{{margin:0;font:16px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg)}}
a{{color:var(--accent);text-decoration:none}}a:hover{{text-decoration:underline}}
header.topbar{{border-bottom:1px solid var(--line);background:#0a060f;position:sticky;top:0;z-index:5}}
header.topbar .inner{{max-width:880px;margin:0 auto;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}}
header.topbar a.brand{{font-weight:700;color:var(--fg)}}
nav a{{margin-left:14px;color:var(--mute);font-size:13px}}
.wrap{{max-width:880px;margin:0 auto;padding:32px 22px}}
h1{{font-size:28px;margin:0 0 8px}}
.lead{{color:var(--mute);margin-bottom:28px}}
.card{{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:14px;color:var(--fg);transition:.2s}}
.card:hover{{border-color:var(--accent);text-decoration:none;transform:translateY(-1px)}}
.card .t{{font-size:18px;font-weight:600;color:var(--fg);margin:0 0 6px}}
.card .s{{font-size:13px;color:var(--mute);margin:0 0 8px}}
.card .d{{font-size:14px;color:#cfc4ad;margin:0}}
footer{{border-top:1px solid var(--line);margin-top:48px;padding:24px 22px;color:var(--mute);font-size:13px;text-align:center}}
</style>
</head>
<body>
<header class="topbar">
  <div class="inner">
    <a class="brand" href="/">wedding-tv.cn</a>
    <nav>
      <a href="/">首页</a>
      <a href="/news/">📰 资讯</a>
      <a href="/insights/">📊 洞察</a>
      <a href="/blog.html">博客</a>
    </nav>
  </div>
</header>
<main class="wrap">
<h1>📊 婚礼行业洞察</h1>
<p class="lead">wedding-tv.cn 研究组每周出品的婚礼 / 婚庆 / 婚恋深度长文。共 {total} 篇。</p>
{cards}
</main>
<footer>© wedding-tv.cn · <a href="/privacy.html">隐私</a> · <a href="/terms.html">条款</a> · <a href="/about.html">关于</a> · <a href="/sitemap.xml">Sitemap</a></footer>
</body>
</html>
"""


def rebuild_index() -> None:
    INSIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    for f in INSIGHTS_DIR.glob("*.html"):
        if f.name == "index.html":
            continue
        try:
            txt = f.read_text("utf-8")
            m_title = re.search(r"<h1>(?:<span[^>]*>[^<]*</span>)?([^<]+)</h1>", txt)
            m_summary = re.search(r'<p class="intro">([^<]+)</p>', txt)
            m_date = re.search(r"🗓️ ([\d\-]+)", txt)
            m_wc = re.search(r"· (\d+) 字", txt)
            if not m_title:
                continue
            entries.append({
                "file": f.name,
                "title": m_title.group(1).strip(),
                "summary": (m_summary.group(1).strip() if m_summary else ""),
                "date": (m_date.group(1).strip() if m_date else ""),
                "wc": (m_wc.group(1) if m_wc else ""),
            })
        except Exception:
            continue
    entries.sort(key=lambda x: x["date"], reverse=True)
    cards = "\n".join(
        f'<a class="card" href="/insights/{esc(e["file"])}">\n'
        f'  <p class="t">{esc(e["title"])}</p>\n'
        f'  <p class="s">🗓️ {esc(e["date"])} · 📖 {esc(e["wc"])} 字深度长文</p>\n'
        f'  <p class="d">{esc(e["summary"][:140])}</p>\n'
        f'</a>'
        for e in entries
    ) or '<p style="color:#b9b1a3">首篇洞察长文即将发布。</p>'
    (INSIGHTS_DIR / "index.html").write_text(
        INDEX_TEMPLATE.format(total=len(entries), cards=cards),
        "utf-8",
    )
    log(f"  ✓ insights/index.html（{len(entries)} 篇）")


def update_sitemap(slug: str, pub_date: str) -> None:
    if not SITEMAP.exists():
        return
    xml = SITEMAP.read_text("utf-8")
    if "https://wedding-tv.cn/insights/</loc>" not in xml:
        xml = xml.replace(
            "</urlset>",
            "  <url>\n"
            "    <loc>https://wedding-tv.cn/insights/</loc>\n"
            f"    <lastmod>{pub_date}</lastmod>\n"
            "    <changefreq>weekly</changefreq>\n"
            "    <priority>0.85</priority>\n"
            "  </url>\n</urlset>",
        )
    url = f"https://wedding-tv.cn/insights/{slug}.html"
    if url not in xml:
        xml = xml.replace(
            "</urlset>",
            "  <url>\n"
            f"    <loc>{url}</loc>\n"
            f"    <lastmod>{pub_date}</lastmod>\n"
            "    <changefreq>yearly</changefreq>\n"
            "    <priority>0.8</priority>\n"
            "  </url>\n</urlset>",
        )
    SITEMAP.write_text(xml, "utf-8")
    log("  ✓ sitemap.xml 已更新")


def main() -> int:
    log("启动行业洞察生成器")
    if not os.environ.get("DASHSCOPE_API_KEY"):
        log("⚠️ 未配置 DASHSCOPE_API_KEY")
        return 0
    INSIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()
    topic = pick_topic(state)
    if not topic:
        log("无可用主题")
        return 0
    log(f"本周选题：{topic}")

    article = call_qwen(topic)
    if not article:
        log("生成失败")
        return 1

    pub_dt = datetime.now(BJ_TZ)
    fp = hashlib.md5(topic.encode("utf-8")).hexdigest()[:10]
    slug = f"{pub_dt.strftime('%Y%m%d')}-{fp}"
    out = INSIGHTS_DIR / f"{slug}.html"
    out.write_text(render(article, slug, pub_dt), "utf-8")
    log(f"  ✓ 已保存 insights/{slug}.html")

    state.setdefault("published_topics", []).append(topic)
    save_state(state)
    update_sitemap(slug, pub_dt.strftime("%Y-%m-%d"))
    rebuild_index()
    n = build_rss()
    log(f"  ✓ rss.xml 重建（{n} 条）")
    log("完成")
    return 0


if __name__ == "__main__":
    sys.exit(main())
