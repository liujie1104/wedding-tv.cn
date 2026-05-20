#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 全站 RSS 重建器

扫描以下来源并生成 /rss.xml：
  - blog/*.html          省份婚俗页（静态）
  - news/*.html          AI 新闻（每日）
  - insights/*.html      行业洞察长文（每周）

被 auto_news.py 和 auto_insights.py 在每次发布后调用，保持 RSS 同步。
"""
from __future__ import annotations

import re
import html
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RSS = ROOT / "rss.xml"
SITE = "https://wedding-tv.cn"

# 允许扫描的目录及其分类标签
SECTIONS = [
    ("news", "婚礼资讯"),
    ("insights", "行业洞察"),
    ("blog", "婚俗指南"),
]


def _extract(file: Path) -> dict | None:
    try:
        txt = file.read_text("utf-8", errors="ignore")
    except Exception:
        return None
    m_title = re.search(r"<title>([^<]+)</title>", txt)
    if not m_title:
        return None
    title = re.sub(r"\s*\|.*$", "", m_title.group(1).strip())
    m_desc = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', txt)
    desc = m_desc.group(1).strip() if m_desc else ""
    # 优先用 og:url / canonical
    m_canon = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', txt)
    if m_canon:
        link = m_canon.group(1).strip()
    else:
        rel = file.relative_to(ROOT).as_posix()
        link = f"{SITE}/{rel}"
    # 日期：从文件名 YYYYMMDD 解析，否则用 mtime
    m_date = re.match(r"(\d{8})", file.stem)
    if m_date:
        try:
            dt = datetime.strptime(m_date.group(1), "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            dt = datetime.fromtimestamp(file.stat().st_mtime, tz=timezone.utc)
    else:
        dt = datetime.fromtimestamp(file.stat().st_mtime, tz=timezone.utc)
    return {"title": title, "desc": desc, "link": link, "dt": dt}


def build_rss(max_items: int = 80) -> int:
    items: list[tuple[dict, str]] = []
    for sub, label in SECTIONS:
        d = ROOT / sub
        if not d.is_dir():
            continue
        for f in d.glob("*.html"):
            if f.name == "index.html":
                continue
            info = _extract(f)
            if info:
                items.append((info, label))
    items.sort(key=lambda x: x[0]["dt"], reverse=True)
    items = items[:max_items]

    last_build = format_datetime(datetime.now(timezone.utc))
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "<channel>",
        "  <title>wedding-tv.cn — 婚礼资讯 / 行业洞察 / 34省婚俗</title>",
        f"  <link>{SITE}/</link>",
        f'  <atom:link href="{SITE}/rss.xml" rel="self" type="application/rss+xml" />',
        "  <description>每日婚礼热点、每周行业洞察、全国婚俗完全指南</description>",
        "  <language>zh-CN</language>",
        f"  <lastBuildDate>{last_build}</lastBuildDate>",
        "  <generator>wedding-tv.cn rss_builder</generator>",
    ]
    for info, label in items:
        title = html.escape(info["title"], quote=False)
        desc = html.escape(info["desc"], quote=False)
        link = info["link"]
        pub = format_datetime(info["dt"])
        parts.append(
            "  <item>\n"
            f"    <title><![CDATA[{title}]]></title>\n"
            f"    <link>{link}</link>\n"
            f'    <guid isPermaLink="true">{link}</guid>\n'
            f"    <description><![CDATA[{desc}]]></description>\n"
            f"    <pubDate>{pub}</pubDate>\n"
            f"    <category>{label}</category>\n"
            "  </item>"
        )
    parts.append("</channel>\n</rss>\n")
    RSS.write_text("\n".join(parts), "utf-8")
    return len(items)


if __name__ == "__main__":
    n = build_rss()
    print(f"rss.xml rebuilt with {n} items")
