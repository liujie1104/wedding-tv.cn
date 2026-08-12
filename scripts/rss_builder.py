#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 审核期 RSS 重建器。

只输出核心工具、指南、透明度页面和逐篇审校的地区文章，避免把自动新闻、洞察和程序化城市页重新推到公开订阅入口。
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
        "title": "婚礼视频与直播行业指南",
        "link": f"{SITE}/guide.html",
        "desc": "婚礼视频、直播、MV 需求拆分、报价核对与服务商评估清单。",
    },
    {
        "title": "婚礼云直播服务商怎么选",
        "link": f"{SITE}/guide-livestream.html",
        "desc": "码率、延迟、机位、价格和避坑清单。",
    },
    {
        "title": "婚礼预算分配与记账指南",
        "link": f"{SITE}/wedding-budget-planning-guide.html",
        "desc": "按总额、优先级、备用金和付款节点建立可复算的婚礼预算。",
    },
    {
        "title": "婚庆合同签约核对指南",
        "link": f"{SITE}/wedding-vendor-contract-guide.html",
        "desc": "核对服务范围、人员、交付、付款、改期、版权和违约责任。",
    },
    {
        "title": "内容编辑规范与数据来源",
        "link": f"{SITE}/editorial-policy.html",
        "desc": "说明本站内容责任、来源要求、AI 辅助边界和纠错流程。",
    },
    {
        "title": "广东婚俗具体指南：连南八排瑶与盐田疍家婚礼",
        "link": f"{SITE}/blog/guangdong.html",
        "desc": "连南八排瑶五阶段婚俗、盐田疍家水陆迎亲与现代执行清单。",
    },
    {
        "title": "福建婚俗具体指南：霞浦畲族五关与福安喜娘",
        "link": f"{SITE}/blog/fujian.html",
        "desc": "霞浦畲族迎亲五关、成亲与头转客，以及福安喜娘具体职责。",
    },
    {
        "title": "湖南婚俗具体指南：湘西土家哭嫁与凤凰苗族婚俗",
        "link": f"{SITE}/blog/hunan.html",
        "desc": "湘西土家哭嫁曲目、凤凰赶边边场及泸溪婚礼具体记录。",
    },
    {
        "title": "四川婚俗具体指南：美姑彝族与古蔺苗族婚俗",
        "link": f"{SITE}/blog/sichuan.html",
        "desc": "美姑彝族口头演述、哭嫁及古蔺苗族对歌、腰带与嫁衣。",
    },
    {
        "title": "浙江婚俗具体指南：宁海十里红妆与景宁畲族婚礼",
        "link": f"{SITE}/blog/zhejiang.html",
        "desc": "宁海十里红妆九步顺序、万工轿及景宁畲族婚礼具体动作。",
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
        "  <description>免费婚礼工具，以及预算、合同、影像交付和视频直播指南。</description>",
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
