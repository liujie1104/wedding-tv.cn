#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 全自动婚礼热点资讯生成器

流程：
  1. 抓取多源热搜（vvhan 聚合 + RSSHub 公开实例 + 新浪 RSS）
  2. 关键词过滤 → 只保留与婚礼/婚庆/婚恋相关的热点
  3. 与 news_state.json 已发布列表去重
  4. 调通义千问 qwen-plus-latest 生成原创点评文章（JSON）
  5. 渲染 HTML（与站点风格一致，带 Article + FAQPage Schema）
  6. 更新 sitemap.xml、news/index.html、blog.html 入口
  7. 写回 news_state.json

环境变量：
  DASHSCOPE_API_KEY  通义千问 API Key（必需）
  MAX_ARTICLES       本次最多生成几篇（默认 2）
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import html
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable

import requests

try:
    from rss_builder import build_rss
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from rss_builder import build_rss

# ---------- 配置 ----------

ROOT = Path(__file__).resolve().parent.parent
NEWS_DIR = ROOT / "news"
SITEMAP = ROOT / "sitemap.xml"
STATE_FILE = ROOT / "scripts" / "news_state.json"
BLOG_INDEX = ROOT / "blog.html"

MAX_ARTICLES = int(os.environ.get("MAX_ARTICLES", "2"))
BJ_TZ = timezone(timedelta(hours=8))

# 婚礼/婚庆/婚恋关键词（用于 Google News RSS 搜索，每个词独立查询）
# 这些词命中即视为相关；搜索时按关键词查询，返回结果已天然相关
QUERY_KEYWORDS = [
    "婚礼", "婚庆", "结婚", "婚纱", "婚姻",
    "求婚", "明星婚讯", "蜜月", "彩礼",
]

# 二次过滤关键词（确保标题确实是婚礼主题，剔除"婚姻法"等边缘命中）
RELEVANT_WORDS = [
    "婚礼", "婚庆", "婚宴", "婚纱", "婚戒", "结婚", "求婚", "订婚",
    "迎亲", "新娘", "新郎", "伴娘", "伴郎", "彩礼", "嫁妆",
    "蜜月", "婚房", "喜帖", "请帖", "婚车", "婚俗", "婚介",
    "领证", "婚检", "再婚", "裸婚", "婚闹", "婚后", "婚前",
    "婚姻", "夫妻", "婚讯", "婚照", "喜糖", "喜事",
    "恋情", "官宣", "复合", "情侣", "情人节", "七夕", "520",
]

# 热搜数据源：使用 Google News RSS（GitHub Actions runner 海外 IP 100% 可达）
# 每个关键词独立查询，hl=zh-CN 简体中文，gl=CN 中国地区
SOURCES = [
    {
        "name": f"Google新闻·{kw}",
        "type": "rss",
        "url": f"https://news.google.com/rss/search?q={requests.utils.quote(kw)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    }
    for kw in QUERY_KEYWORDS
] + [
    # Bing News RSS 备份源
    {
        "name": f"Bing新闻·{kw}",
        "type": "rss",
        "url": f"https://www.bing.com/news/search?q={requests.utils.quote(kw)}&setlang=zh-CN&format=RSS",
    }
    for kw in ["婚礼", "婚庆", "结婚"]
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
TIMEOUT = 12


# ---------- 工具函数 ----------

def log(msg: str) -> None:
    print(f"[auto-news] {msg}", flush=True)


def fingerprint(title: str) -> str:
    """标题指纹，用于去重。"""
    norm = re.sub(r"\s+", "", title)
    return hashlib.md5(norm.encode("utf-8")).hexdigest()[:12]


def normalize_title(title: str) -> str:
    """标题归一化：用于近似重复判断。"""
    t = title.strip().lower()
    # 去掉常见来源后缀，如 " - Google 新闻" / "｜央视网"
    t = re.sub(r"\s*[-|｜]\s*[^-|｜]{1,20}$", "", t)
    # 按常见分隔符截断，优先保留核心主语片段
    parts = [p.strip() for p in re.split(r"[：:？?！!。；;]", t) if p.strip()]
    if parts:
        t = max(parts, key=len)
    # 清理噪音字符，仅保留中英文数字
    t = re.sub(r"[^\u4e00-\u9fa5a-z0-9]", "", t)
    return t


def title_similarity(a: str, b: str) -> float:
    """基于 2-gram 的 Jaccard 相似度。"""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if len(a) >= 10 and len(b) >= 10 and (a in b or b in a):
        return 0.95
    if len(a) < 2 or len(b) < 2:
        return 0.0
    ga = {a[i:i + 2] for i in range(len(a) - 1)}
    gb = {b[i:i + 2] for i in range(len(b) - 1)}
    union = ga | gb
    if not union:
        return 0.0
    return len(ga & gb) / len(union)


def load_existing_title_norms() -> list[str]:
    """读取已发布文章标题，用于近似去重。"""
    norms: list[str] = []
    if not NEWS_DIR.exists():
        return norms
    for f in NEWS_DIR.glob("*.html"):
        if f.name == "index.html":
            continue
        try:
            txt = f.read_text("utf-8", errors="ignore")
        except Exception:
            continue
        m = re.search(r"<h1>([^<]+)</h1>", txt)
        if not m:
            continue
        norm = normalize_title(m.group(1))
        if norm:
            norms.append(norm)
    return norms


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text("utf-8"))
        except Exception:
            pass
    return {"published": []}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), "utf-8")


# ---------- 抓取 ----------

def fetch_one(src: dict) -> list[dict]:
    """抓取一个 RSS 源，解析为 [{title, source, url}, ...]。"""
    import xml.etree.ElementTree as ET
    try:
        r = requests.get(
            src["url"],
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
            },
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        text = r.text
    except Exception as e:
        log(f"  ✗ {src['name']} 抓取失败：{type(e).__name__}: {str(e)[:120]}")
        return []

    items: list[dict] = []
    try:
        root = ET.fromstring(text)
        # 同时兼容 RSS 2.0 (channel/item) 和 Atom (entry)
        for item in root.iter():
            tag = item.tag.split("}")[-1]  # 去 namespace
            if tag not in ("item", "entry"):
                continue
            title = ""
            link = ""
            for child in item:
                ctag = child.tag.split("}")[-1]
                if ctag == "title" and child.text:
                    title = child.text.strip()
                elif ctag == "link":
                    link = (child.text or child.get("href") or "").strip()
            if title:
                items.append({"title": title, "source": src["name"], "url": link})
            if len(items) >= 30:
                break
    except Exception as e:
        log(f"  ✗ {src['name']} 解析失败：{type(e).__name__}: {str(e)[:120]}")
        return []

    log(f"  ✓ {src['name']}：{len(items)} 条" + (f" | 示例: {items[0]['title'][:50]}" if items else ""))
    return items


def fetch_all() -> list[dict]:
    log("抓取热搜源…")
    all_items: list[dict] = []
    for src in SOURCES:
        all_items.extend(fetch_one(src))
        time.sleep(0.5)
    log(f"合计 {len(all_items)} 条原始热点")
    return all_items


def filter_relevant(items: list[dict], state: dict) -> list[dict]:
    """关键词过滤 + 去重 + 已发布过滤。"""
    published = set(state.get("published", []))
    historical_norms = load_existing_title_norms()
    accepted_norms: list[str] = []
    keep: list[dict] = []
    seen: set[str] = set()
    for it in items:
        t = it["title"]
        fp = fingerprint(t)
        if fp in seen or fp in published:
            continue
        if any(k in t for k in RELEVANT_WORDS):
            norm = normalize_title(t)
            similar_exists = any(title_similarity(norm, old) >= 0.72 for old in (historical_norms + accepted_norms))
            if similar_exists:
                continue
            it["fp"] = fp
            it["norm"] = norm
            seen.add(fp)
            accepted_norms.append(norm)
            keep.append(it)
    log(f"婚礼相关：{len(keep)} 条候选 / 已发布历史 {len(published)} 条")
    if not keep and items:
        # 调试：输出前 10 条原始标题，方便排查为何无命中
        log("  · 未命中关键词，部分原始热点示例：")
        for i in items[:10]:
            log(f"    [{i['source']}] {i['title'][:60]}")
    return keep


# ---------- AI 生成 ----------

def call_qwen(hot_title: str, source: str) -> dict | None:
    """调用通义千问生成结构化文章 JSON。"""
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        log("  ✗ 未配置 DASHSCOPE_API_KEY，跳过")
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
        "你是 wedding-tv.cn 的资深婚礼行业内容编辑。"
        "请围绕用户给出的热点话题，从婚礼/婚庆/婚恋行业视角写一篇 800-1200 字的原创中文点评文章。"
        "要求：\n"
        "1. 标题：吸引人、不超过 30 字、自然包含婚礼/婚庆/婚恋等关键词\n"
        "2. 摘要：80 字内\n"
        "3. 正文：3-4 个二级小标题，每段 200-350 字，观点鲜明、有数据或案例支撑\n"
        "4. 结尾段必须自然引导读者使用 wedding-tv.cn 提供的免费工具"
        "（如：吉日查询/预算计算器/电子请帖/AI 誓词/AI 致辞/筹备清单/流程时间轴）\n"
        "5. 文风：客观、专业、有温度，不出现广告夸张语\n"
        "6. 不得编造未经证实的明星隐私或负面爆料\n"
        "7. 输出严格 JSON，不要 markdown 包裹。结构：\n"
        '{"title":"...","summary":"...","keywords":["...","..."],'
        '"sections":[{"h2":"...","content":"..."}],'
        '"faq":[{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}]}'
    )
    user_prompt = f"热点来源：{source}\n热点标题：{hot_title}\n请生成文章。"

    try:
        resp = client.chat.completions.create(
            model="qwen-plus-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
            timeout=60,
        )
        raw = resp.choices[0].message.content or ""
        data = json.loads(raw)
        # 简单校验
        if not data.get("title") or not data.get("sections"):
            log("  ✗ AI 返回缺字段")
            return None
        return data
    except Exception as e:
        log(f"  ✗ AI 调用失败：{e}")
        return None


# ---------- HTML 渲染 ----------

PAGE_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title_esc} | wedding-tv.cn 婚礼热点</title>
<meta name="description" content="{summary_esc}" />
<meta name="keywords" content="{keywords_csv}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://wedding-tv.cn/news/{slug}.html" />
<meta property="og:title" content="{title_esc}" />
<meta property="og:description" content="{summary_esc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://wedding-tv.cn/news/{slug}.html" />
<meta property="og:image" content="https://wedding-tv.cn/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title_esc}" />
<meta name="twitter:description" content="{summary_esc}" />
<meta name="twitter:image" content="https://wedding-tv.cn/og.png" />
<meta name="theme-color" content="#0e0a14" />
<meta name="google-adsense-account" content="ca-pub-6560247681968502" />
<script async fetchpriority="low" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>📰</text></svg>" />
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
p{{margin:14px 0}}
.intro{{font-size:16px;color:#e8dfca;background:rgba(212,165,116,.06);padding:16px 18px;border-radius:8px;border-left:3px solid var(--accent)}}
.faq-section{{margin:40px 0 24px;padding:24px;background:var(--card);border:1px solid var(--line);border-radius:12px}}
.faq-section details{{margin:14px 0;padding:12px 14px;background:#0e0a14;border-radius:8px;border:1px solid var(--line)}}
.faq-section summary{{cursor:pointer;font-weight:600;color:var(--accent)}}
.cta{{background:linear-gradient(135deg,rgba(212,165,116,.12),var(--card));border:1px solid var(--accent);border-radius:12px;padding:20px;margin:32px 0}}
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
      <a href="/blog.html">博客</a>
      <a href="/almanac.html">📅 吉日</a>
      <a href="/invitation.html">💌 请帖</a>
    </nav>
  </div>
</header>
<main class="wrap">
<div class="crumbs"><a href="/">首页</a> · <a href="/news/">婚礼资讯</a> · 当前文章</div>
<h1>{title_esc}</h1>
<div class="meta"><span>📰 来源：{source_esc}</span><span>🗓️ 发布：{date_str}</span><span>📖 阅读约 {read_min} 分钟</span></div>
<p class="intro">{summary_esc}</p>
{sections_html}
{faq_html}
<div class="cta">
  <h3>🎁 wedding-tv.cn 婚礼筹备免费工具</h3>
  <p style="margin:0 0 8px;color:var(--mute);font-size:14px">无需注册，纯前端生成，全部免费：</p>
  <a href="/almanac.html">📅 婚期吉日</a>
  <a href="/calculator.html">💰 预算计算</a>
  <a href="/invitation.html">💌 电子请帖</a>
  <a href="/timeline.html">⏱️ 流程时间轴</a>
  <a href="/vows.html">💍 AI 誓词</a>
  <a href="/speech.html">🎤 AI 致辞</a>
  <a href="/playlist.html">🎵 婚礼歌单</a>
  <a href="/checklist.html">📋 筹备清单</a>
</div>
<p class="disclaimer">📌 本文由 wedding-tv.cn AI 编辑团队根据公开热点信息原创点评，仅代表作者本人观点。文中涉及的人物、事件描述如有出入，以权威媒体报道为准。如需联系修改或撤稿，请通过 <a href="/about.html">关于页面</a> 与我们联系。</p>
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


def render_article(article: dict, source: str, slug: str, pub_dt: datetime) -> str:
    title = article["title"].strip()
    summary = (article.get("summary") or "").strip()
    keywords = article.get("keywords") or []
    sections = article.get("sections") or []
    faq = article.get("faq") or []

    # 正文
    parts = []
    total_text = summary
    for sec in sections:
        h2 = (sec.get("h2") or "").strip()
        content = (sec.get("content") or "").strip()
        if not h2 or not content:
            continue
        # 段落拆分
        paras = [p.strip() for p in re.split(r"\n{2,}|\r\n\r\n", content) if p.strip()]
        if not paras:
            paras = [content]
        body = "\n".join(f"<p>{esc(p)}</p>" for p in paras)
        parts.append(f'<h2>{esc(h2)}</h2>\n{body}')
        total_text += content
    sections_html = "\n".join(parts)

    # FAQ
    faq_html = ""
    faq_ld_block = ""
    if faq:
        items = []
        ld_main = []
        for qa in faq[:5]:
            q = (qa.get("q") or "").strip()
            a = (qa.get("a") or "").strip()
            if not q or not a:
                continue
            items.append(
                f'  <details>\n    <summary>{esc(q)}</summary>\n'
                f'    <p style="margin:10px 0 0;color:var(--fg);line-height:1.85">{esc(a)}</p>\n  </details>'
            )
            ld_main.append({
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            })
        if items:
            faq_html = (
                '<section class="faq-section">\n'
                '  <h2 style="margin-top:0;border:none;padding:0">❓ 相关常见问题</h2>\n'
                + "\n".join(items)
                + "\n</section>"
            )
            faq_ld_block = (
                '<script type="application/ld+json">\n'
                + json.dumps(
                    {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": ld_main},
                    ensure_ascii=False,
                )
                + "\n</script>"
            )

    article_ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": title,
        "description": summary,
        "author": {"@type": "Organization", "name": "wedding-tv.cn AI 编辑"},
        "publisher": {"@type": "Organization", "name": "wedding-tv.cn", "url": "https://wedding-tv.cn/"},
        "datePublished": pub_dt.isoformat(),
        "dateModified": pub_dt.isoformat(),
        "mainEntityOfPage": f"https://wedding-tv.cn/news/{slug}.html",
        "image": "https://wedding-tv.cn/og.png",
        "keywords": ",".join(keywords),
    }, ensure_ascii=False)

    read_min = max(2, len(total_text) // 400)

    return PAGE_TEMPLATE.format(
        title_esc=esc(title),
        summary_esc=esc(summary),
        keywords_csv=esc(",".join(keywords + ["婚礼资讯", "婚庆热点", "wedding-tv.cn"])),
        slug=slug,
        article_ld=article_ld,
        faq_ld_block=faq_ld_block,
        source_esc=esc(source),
        date_str=pub_dt.strftime("%Y-%m-%d"),
        read_min=read_min,
        sections_html=sections_html,
        faq_html=faq_html,
    )


# ---------- 索引 / sitemap ----------

NEWS_INDEX_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>婚礼热点资讯 | wedding-tv.cn</title>
<meta name="description" content="wedding-tv.cn 婚礼行业热点资讯：每天自动汇总并点评婚礼、婚庆、婚恋领域的最新热点话题。" />
<meta name="keywords" content="婚礼新闻,婚庆资讯,婚恋热点,婚礼热点,wedding news" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://wedding-tv.cn/news/" />
<meta name="theme-color" content="#0e0a14" />
<meta name="google-adsense-account" content="ca-pub-6560247681968502" />
<script async fetchpriority="low" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>📰</text></svg>" />
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
.card .t{{font-size:17px;font-weight:600;color:var(--fg);margin:0 0 6px}}
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
      <a href="/blog.html">博客</a>
      <a href="/almanac.html">📅 吉日</a>
      <a href="/invitation.html">💌 请帖</a>
    </nav>
  </div>
</header>
<main class="wrap">
<h1>📰 婚礼热点资讯</h1>
<p class="lead">每天自动汇总并点评全网婚礼、婚庆、婚恋领域的最新热点。共 {total} 篇文章。</p>
{cards}
</main>
<footer>© wedding-tv.cn · <a href="/privacy.html">隐私</a> · <a href="/terms.html">条款</a> · <a href="/about.html">关于</a> · <a href="/sitemap.xml">Sitemap</a></footer>
</body>
</html>
"""


def rebuild_news_index() -> None:
    NEWS_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    for f in NEWS_DIR.glob("*.html"):
        if f.name == "index.html":
            continue
        try:
            txt = f.read_text("utf-8")
            m_title = re.search(r"<h1>([^<]+)</h1>", txt)
            m_summary = re.search(r'<p class="intro">([^<]+)</p>', txt)
            m_date = re.search(r"🗓️ 发布：([\d\-]+)", txt)
            m_src = re.search(r"📰 来源：([^<]+)</span>", txt)
            if not m_title:
                continue
            entries.append({
                "file": f.name,
                "title": m_title.group(1).strip(),
                "summary": (m_summary.group(1).strip() if m_summary else ""),
                "date": (m_date.group(1).strip() if m_date else ""),
                "source": (m_src.group(1).strip() if m_src else ""),
            })
        except Exception:
            continue
    entries.sort(key=lambda x: x["date"], reverse=True)

    # 展示层去重：保留较新的一条，折叠近似同题材文章（不删除原文）
    shown: list[dict] = []
    shown_norms: list[str] = []
    for e in entries:
        norm = normalize_title(e["title"])
        if any(title_similarity(norm, old) >= 0.72 for old in shown_norms):
            continue
        shown.append(e)
        shown_norms.append(norm)

    cards = "\n".join(
        f'<a class="card" href="/news/{esc(e["file"])}">\n'
        f'  <p class="t">{esc(e["title"])}</p>\n'
        f'  <p class="s">🗓️ {esc(e["date"])} · 📰 {esc(e["source"])}</p>\n'
        f'  <p class="d">{esc(e["summary"][:120])}</p>\n'
        f'</a>'
        for e in shown
    ) or '<p style="color:#b9b1a3">暂无文章，请稍候。</p>'
    (NEWS_DIR / "index.html").write_text(
        NEWS_INDEX_TEMPLATE.format(total=len(shown), cards=cards),
        "utf-8",
    )
    dropped = max(0, len(entries) - len(shown))
    log(f"  ✓ news/index.html 已更新（展示 {len(shown)} 篇，折叠 {dropped} 篇近似稿）")


def update_sitemap(new_slugs: list[str], pub_date: str) -> None:
    if not new_slugs or not SITEMAP.exists():
        return
    xml = SITEMAP.read_text("utf-8")

    # 加 /news/ 索引（只加一次）
    if "https://wedding-tv.cn/news/</loc>" not in xml:
        block = (
            "  <url>\n"
            "    <loc>https://wedding-tv.cn/news/</loc>\n"
            f"    <lastmod>{pub_date}</lastmod>\n"
            "    <changefreq>daily</changefreq>\n"
            "    <priority>0.85</priority>\n"
            "  </url>\n"
        )
        xml = xml.replace("</urlset>", block + "</urlset>")

    for slug in new_slugs:
        url = f"https://wedding-tv.cn/news/{slug}.html"
        if url in xml:
            continue
        block = (
            "  <url>\n"
            f"    <loc>{url}</loc>\n"
            f"    <lastmod>{pub_date}</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.7</priority>\n"
            "  </url>\n"
        )
        xml = xml.replace("</urlset>", block + "</urlset>")

    # 刷新核心索引页 lastmod，提升抓取时效信号
    for loc in [
        "https://wedding-tv.cn/news/",
        "https://wedding-tv.cn/blog.html",
    ]:
        xml = re.sub(
            rf"(<loc>{re.escape(loc)}</loc>\s*<lastmod>)([^<]+)(</lastmod>)",
            rf"\g<1>{pub_date}\g<3>",
            xml,
            count=1,
        )

    SITEMAP.write_text(xml, "utf-8")
    log(f"  ✓ sitemap.xml 已写入 {len(new_slugs)} 条新 URL")


def ensure_blog_index_entry() -> None:
    """在 blog.html 的导航里加一个 /news/ 入口（幂等）。"""
    if not BLOG_INDEX.exists():
        return
    txt = BLOG_INDEX.read_text("utf-8")
    if 'href="/news/"' in txt:
        return
    # 在第一个 <nav> 里追加
    new_txt, n = re.subn(
        r'(<nav[^>]*>\s*(?:<a[^>]*>[^<]*</a>\s*)*)',
        r'\1<a href="/news/">📰 资讯</a>',
        txt,
        count=1,
    )
    if n:
        BLOG_INDEX.write_text(new_txt, "utf-8")
        log("  ✓ blog.html 已加 /news/ 导航入口")


# ---------- 主流程 ----------

def main() -> int:
    log(f"开始运行（每次最多 {MAX_ARTICLES} 篇）")
    if not os.environ.get("DASHSCOPE_API_KEY"):
        log("⚠️  警告：未检测到 DASHSCOPE_API_KEY 环境变量！")
        log("⚠️  请到 GitHub 仓库 Settings → Secrets and variables → Actions")
        log("⚠️  新建 secret 名为 DASHSCOPE_API_KEY，值为阿里云百炼的 sk-xxx... API Key")
        log("⚠️  本次将仍尝试抓取热点用于诊断，但不会生成文章。")
    NEWS_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()

    items = fetch_all()
    if not items:
        log("没有抓到任何热点，退出。")
        return 0

    candidates = filter_relevant(items, state)
    if not candidates:
        log("没有与婚礼相关的新热点，退出。")
        return 0

    pub_dt = datetime.now(BJ_TZ)
    pub_date_str = pub_dt.strftime("%Y-%m-%d")
    new_slugs: list[str] = []
    success = 0

    for cand in candidates:
        if success >= MAX_ARTICLES:
            break
        log(f"生成中：[{cand['source']}] {cand['title'][:40]}…")
        article = call_qwen(cand["title"], cand["source"])
        if not article:
            continue
        slug = f"{pub_dt.strftime('%Y%m%d')}-{cand['fp']}"
        html_out = render_article(article, cand["source"], slug, pub_dt)
        (NEWS_DIR / f"{slug}.html").write_text(html_out, "utf-8")
        state.setdefault("published", []).append(cand["fp"])
        new_slugs.append(slug)
        success += 1
        log(f"  ✓ 已保存 news/{slug}.html")
        time.sleep(1)

    if success == 0:
        log("本轮没有生成任何文章。")
        return 0

    # 控制 published 列表长度（避免无限增长）
    state["published"] = state["published"][-2000:]
    save_state(state)
    update_sitemap(new_slugs, pub_date_str)
    rebuild_news_index()
    ensure_blog_index_entry()
    try:
        n = build_rss()
        log(f"  ✓ rss.xml 重建（{n} 条）")
    except Exception as e:
        log(f"  ⚠ rss 重建失败：{e}")
    log(f"完成：本次生成 {success} 篇")
    return 0


if __name__ == "__main__":
    sys.exit(main())
