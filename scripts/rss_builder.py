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
        "desc": "连南八排瑶五阶段与先生公历史记录，以及盐田划旱船、咸茶和大碗疍。",
    },
    {
        "title": "福建婚俗具体指南：霞浦畲族五关与福安喜娘",
        "link": f"{SITE}/blog/fujian.html",
        "desc": "霞浦迎亲五关、凤凰装，以及赤郎、接姑、赤郎子参与的三天迎亲和歌桌。",
    },
    {
        "title": "湖南婚俗具体指南：湘西土家哭嫁与凤凰苗族婚俗",
        "link": f"{SITE}/blog/hunan.html",
        "desc": "土家哭嫁席位、泸溪插花日迎亲队，以及花瑶媒公、拦门酒和挑花。",
    },
    {
        "title": "四川婚俗具体指南：美姑彝族与古蔺苗族婚俗",
        "link": f"{SITE}/blog/sichuan.html",
        "desc": "美姑婚俗史诗与口头演述，以及古蔺咪哆、咪彩、碰芦笙、腰带和苗服纹样。",
    },
    {
        "title": "浙江婚俗具体指南：宁海十里红妆与景宁畲族婚礼",
        "link": f"{SITE}/blog/zhejiang.html",
        "desc": "宁海红妆器物，以及景宁送糯米、踏路牛、赤郎行郎和 doi 彩带信物。",
    },
    {
        "title": "内蒙古婚俗具体指南：阿日奔苏木婚礼",
        "link": f"{SITE}/blog/inner-mongolia.html",
        "desc": "阿鲁科尔沁旗阿日奔苏木婚礼中的祝赞词家、蒙古包、勒勒车与长调。",
    },
    {
        "title": "甘肃婚俗具体指南：肃南裕固族婚礼",
        "link": f"{SITE}/blog/gansu.html",
        "desc": "肃南裕固族婚礼的28项礼节，以及戴头面、打尖和阿斯哈斯。",
    },
    {
        "title": "青海婚俗具体指南：互助土族婚礼",
        "link": f"{SITE}/blog/qinghai.html",
        "desc": "互助土族婚礼的纳什金、花儿对歌、敬献哈达与安昭。",
    },
    {
        "title": "黑龙江婚俗具体指南：同江赫哲族婚俗",
        "link": f"{SITE}/blog/heilongjiang.html",
        "desc": "同江赫哲族婚俗的彩船彩橇、戒语、祝福歌、做福及展演边界。",
    },
    {
        "title": "吉林婚俗具体指南：延边朝鲜族传统婚礼",
        "link": f"{SITE}/blog/jilin.html",
        "desc": "延边朝鲜族婚礼的议婚、大礼、后礼、礼装函与双方家庭大桌。",
    },
    {
        "title": "北京婚俗具体指南：小定大定与天地桌",
        "link": f"{SITE}/blog/beijing.html",
        "desc": "老北京相看、合婚、小定大定、雁酒、天地桌及晚清民国婚礼变化。",
    },
    {
        "title": "天津婚俗具体指南：下午婚礼与搭棚落座",
        "link": f"{SITE}/blog/tianjin.html",
        "desc": "旧天津下午婚礼、搭大棚落座、街坊帮忙、家请厨师与八大碗。",
    },
    {
        "title": "上海婚俗具体指南：百子大礼轿与海派旗袍",
        "link": f"{SITE}/blog/shanghai.html",
        "desc": "上海婚姻制度变化、民国百子大礼轿、海派旗袍及现代婚俗展示。",
    },
    {
        "title": "重庆婚俗具体指南：黔江土家婚俗",
        "link": f"{SITE}/blog/chongqing.html",
        "desc": "黔江土家花园酒、开脸、头嘎二嘎摸米、拦门礼和哭嫁。",
    },
    {
        "title": "江苏婚俗具体指南：周庄水乡婚礼",
        "link": f"{SITE}/blog/jiangsu.html",
        "desc": "周庄六礼、婚船彩棚、摇快船、铺米袋、走三桥及文旅演出边界。",
    },
    {
        "title": "河北婚俗具体指南：昌黎地秧歌与当代婚礼",
        "link": f"{SITE}/blog/hebei.html",
        "desc": "昌黎地秧歌四类行当、民歌、迎亲演出与河北婚俗改革边界。",
    },
    {
        "title": "山西婚俗具体指南：过帖、花馍与各地回门",
        "link": f"{SITE}/blog/shanxi.html",
        "desc": "过帖地区称谓、许口面、闻喜上头糕和各地不同回门日期。",
    },
    {
        "title": "辽宁婚俗具体指南：蒙古勒津、满族与朝鲜族项目",
        "link": f"{SITE}/blog/liaoning.html",
        "desc": "阜新蒙古勒津婚礼、新宾满族和铁岭朝鲜族项目的地域与展演边界。",
    },
    {
        "title": "安徽婚俗具体指南：徽州九步与宁国畲族婚嫁",
        "link": f"{SITE}/blog/anhui.html",
        "desc": "徽州送担、开脸、回门，以及宁国畲族得定、送日和迎亲。",
    },
    {
        "title": "山东婚俗具体指南：胶东花饽饽与龙凤花轿",
        "link": f"{SITE}/blog/shandong.html",
        "desc": "胶东花饽饽《龙凤呈祥》、荣成海洋渔家文化与乳山婚嫁交通变迁的使用边界。",
    },
    {
        "title": "河南婚俗具体指南：嵩山婚俗与开封婚船",
        "link": f"{SITE}/blog/henan.html",
        "desc": "登封嵩山婚俗七项流程、开封婚船展演，以及传统六礼与现代登记的边界。",
    },
    {
        "title": "湖北婚俗具体指南：孙桥女婚男嫁",
        "link": f"{SITE}/blog/hubei.html",
        "desc": "京山孙桥女婚男嫁、娶新郎与丈母娘抬软轿，并区分土家婚俗舞台展演。",
    },
    {
        "title": "江西婚俗具体指南：龙南客家婚俗",
        "link": f"{SITE}/blog/jiangxi.html",
        "desc": "龙南客家婚俗十二阶段、祖宗纱代、公婆灯、凤眼珍珠汤与同心餐。",
    },
    {
        "title": "陕西婚俗具体指南：陕北与米脂婚俗",
        "link": f"{SITE}/blog/shaanxi.html",
        "desc": "陕北择亲至婚礼六段、稳根鞋和长命带，以及米脂十九项流程。",
    },
    {
        "title": "贵州婚俗具体指南：苗族与侗族村寨实例",
        "link": f"{SITE}/blog/guizhou.html",
        "desc": "雷山苗族夜间对歌与拦门酒、肇兴侗寨订婚礼物、小黄婚礼第一担井水。",
    },
    {
        "title": "海南婚俗具体指南：黎族三月三与三亚回族婚礼",
        "link": f"{SITE}/blog/hainan.html",
        "desc": "黎族三月三、三亚回族尼卡哈与苗族婚礼展演的具体记录和严格边界。",
    },
    {
        "title": "云南婚俗具体指南：白族三道茶与傣族婚礼歌",
        "link": f"{SITE}/blog/yunnan.html",
        "desc": "白族三道茶配料与顺序、傣族章哈婚礼歌及花腰彝族婚嫁项目边界。",
    },
    {
        "title": "广西婚俗具体指南：疍家婚礼与瑶族鸳鸯婚",
        "link": f"{SITE}/blog/guangxi.html",
        "desc": "北海疍家婚礼、壮族歌圩与侬峒节，以及上思瑶族鸳鸯婚四项环节。",
    },
    {
        "title": "宁夏婚俗具体指南：回族婚礼十一环节与宴席曲",
        "link": f"{SITE}/blog/ningxia.html",
        "desc": "回族婚礼十一类程序，以及唱家子、表针线、叙事曲和酒曲子。",
    },
    {
        "title": "新疆婚俗具体指南：四套民族婚礼流程",
        "link": f"{SITE}/blog/xinjiang.html",
        "desc": "维吾尔、锡伯、塔吉克与哈萨克四套婚俗流程和各自地域边界。",
    },
    {
        "title": "西藏婚俗具体指南：拉萨三次提亲与婚礼赞词",
        "link": f"{SITE}/blog/tibet.html",
        "desc": "拉萨三次提亲、彩箭达塔、门赞、马赞、巴地赞及地方项目边界。",
    },
    {
        "title": "台湾地区婚俗具体指南：台南二礼与原住民族婚礼",
        "link": f"{SITE}/blog/taiwan.html",
        "desc": "台南二礼、吃姊妹桌与排湾、鲁凯、泰雅、太鲁阁资料边界。",
    },
    {
        "title": "香港婚俗具体指南：鹤佬渔民叹歌与裙褂",
        "link": f"{SITE}/blog/hong-kong.html",
        "desc": "鹤佬渔民婚嫁叹歌、咸水歌、裙褂制作及拟结婚通知期限。",
    },
    {
        "title": "澳门婚俗具体指南：过大礼与嫁喜礼饼",
        "link": f"{SITE}/blog/macao.html",
        "desc": "过大礼、嫁喜礼饼、裙褂、中西双礼及现行结婚登记期限。",
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
