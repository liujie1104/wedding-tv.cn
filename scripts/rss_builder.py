#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 审核期 RSS 重建器。

只输出核心工具、指南和透明度页面，避免把自动新闻、洞察和程序化城市页重新推到公开订阅入口。
"""
from __future__ import annotations

from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RSS = ROOT / "rss.xml"
SITE = "https://wedding-tv.cn"

CORE_ITEMS = [
    {
        "title": "免费 AI 婚礼策划工具",
        "link": f"{SITE}/ai-planner.html",
        "desc": "按城市、预算、人数和风格生成婚礼方案、婚俗清单与请帖文案。",
    },
    {
        "title": "2026 婚礼视频与直播行业指南",
        "link": f"{SITE}/guide.html",
        "desc": "婚礼视频、直播、MV 报价参考与服务商评估清单。",
    },
    {
        "title": "婚礼云直播服务商怎么选",
        "link": f"{SITE}/guide-livestream.html",
        "desc": "码率、延迟、机位、价格和避坑清单。",
    },
    {
        "title": "城市婚礼预算参考库",
        "link": f"{SITE}/budget-reference.html",
        "desc": "按城市查看婚礼预算区间和中位数参考。",
    },
    {
        "title": "内容编辑规范与数据来源",
        "link": f"{SITE}/editorial-policy.html",
        "desc": "说明本站内容来源、AI 辅助边界和纠错流程。",
    },
]


def build_rss(max_items: int = 80) -> int:
    items = CORE_ITEMS[:max_items]
    last_build = format_datetime(datetime.now(timezone.utc))
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "<channel>",
        "  <title>wedding-tv.cn 婚礼工具与指南</title>",
        f"  <link>{SITE}/</link>",
        f'  <atom:link href="{SITE}/rss.xml" rel="self" type="application/rss+xml" />',
        "  <description>免费婚礼工具、婚礼视频直播指南、预算参考和内容规范。</description>",
        "  <language>zh-CN</language>",
        f"  <lastBuildDate>{last_build}</lastBuildDate>",
        "  <generator>wedding-tv.cn rss_builder review mode</generator>",
    ]
    for item in items:
        parts.append(
            "  <item>\n"
            f"    <title>{item['title']}</title>\n"
            f"    <link>{item['link']}</link>\n"
            f"    <guid>{item['link']}</guid>\n"
            f"    <description>{item['desc']}</description>\n"
            f"    <pubDate>{last_build}</pubDate>\n"
            "  </item>"
        )
    parts.append("</channel>\n</rss>\n")
    RSS.write_text("\n".join(parts), "utf-8")
    return len(items)


if __name__ == "__main__":
    n = build_rss()
    print(f"rss.xml rebuilt with {n} core items")
