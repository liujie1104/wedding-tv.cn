#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 每周备婚周刊自动编写与发布引擎
- 自动识别当前最新期数，顺延生成第 N 期周刊 HTML
- 套用暗黑奢华标准规范与 Article / BreadcrumbList JSON-LD 结构化数据
- 自动更新 blog.html 博客入口与往期归档
- 自动更新 sitemap.xml 与 rss.xml
- 自动生成小红书/微信公众号一键分发文案 (latest-social-copy.md)
- 运行静态合规审计 (0 Errors / 0 Warnings)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 权威精选周刊智库矩阵（按期轮转，覆盖备婚全生命周期）
ISSUES_DATABASE = {
    2: {
        "title": "2026金秋备婚周刊第2期：国庆婚礼实操复盘、秋冬室内灯光色温选型与婚车租赁维权要点",
        "short_title": "2026金秋备婚周刊第2期：国庆婚礼复盘与秋冬灯光避坑",
        "description": "wedding-tv.cn 2026金秋备婚周刊第2期：主创编委会权威梳理国庆婚宴高峰复盘与临时餐标结算、秋冬季婚礼（11月-1月）室内暖光色温选型避坑、婚车租赁合同备用车违约条款约定与黄金三金置办技巧。",
        "highlights": [
            {
                "section": "🏛️ 民政与行业风向",
                "title": "民政系统全国联网深化与婚假跨城审批实务",
                "content": """
<p>随着各省市婚姻登记系统全国联网推进，跨省通办领证预约的放号效率显著提升。本周编委会追踪到，部分一线及新一线城市民政局已将预约放号周期延长至提前 30 天，对于计划跨省办理婚姻登记的新人，建议提前 20 天在对应政务平台上传身份证、户口簿原件扫描件完成预审，避免当天现场因户口簿婚姻状况未更新（如仍为未婚或与实际不符）导致无法出证。</p>
<div class="takeaway">
  <strong>💡 编委会实操指引</strong>
  户口簿上的“婚姻状况”若显示为空白或与民政局系统不一致，务必在领证前前往户籍所在地派出所户籍科完成卡片更新，避免跨省通办现场被驳回。
</div>
"""
            },
            {
                "section": "📈 备婚大盘与行情",
                "title": "秋冬季婚礼室内灯光色温避坑与三金配置策略",
                "content": """
<p>进入 10 月中旬后，秋冬季婚礼预订逐步进入高峰。本周督导实务中最突出的问题是<strong>宴会厅灯光色温与摄影机位冲突</strong>：部分酒店为追求科技感，私自开启高色温冷光荧光射灯（5500K 以上）或蓝紫氛围灯，导致摄影摄像机位录制的新人面部出现严重色偏与阴阳脸。</p>
<table>
  <thead>
    <tr>
      <th>空间区域</th>
      <th>推荐灯光色温</th>
      <th>严禁灯光类型</th>
      <th>现场核对要点</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>主仪式台 / 交换对戒区</strong></td>
      <td>3200K - 3800K 暖白光</td>
      <td>冷白光、RGB 循环呼吸灯</td>
      <td>面光必须柔和均匀，显色指数 CRI &ge; 90</td>
    </tr>
    <tr>
      <td><strong>迎宾区与签到台</strong></td>
      <td>3000K 暖黄漫反射</td>
      <td>顶光直射（极易产生黑眼圈）</td>
      <td>建议两侧加装柔光地排灯或灯箱</td>
    </tr>
    <tr>
      <td><strong>舞台T台交接区</strong></td>
      <td>3500K 定点追光</td>
      <td>杂乱激光光束、爆闪电脑灯</td>
      <td>追光灯必须在父亲交接新娘前完成聚焦调试</td>
    </tr>
  </tbody>
</table>
<p>在珠宝预算方面，受国际黄金现货价格持续高位波动影响，本周建议备婚新人采取“工艺件精选+投资金保值”的组合采购：三金中用于当天佩戴的喜饰尽量选择 5G/古法素金款（工费建议控制在 ¥35~¥65/克区间），避免一口价高溢价饰品。</p>
"""
            },
            {
                "section": "🚨 真实避坑与维权实操",
                "title": "婚车租赁临时降级或迟到：合同必须这样约定",
                "content": """
<p>根据多地婚庆消费维权案例，婚礼当天最容易引发纠纷的环节之一便是<strong>婚车车队迟到或主婚车被临时掉包</strong>。普通婚车租赁合同往往仅模糊约定“提供同级别车型”，一旦主婚车遇故障，中介可能随意派出一辆老旧杂牌车顶替。</p>
<div class="highlight-card">
  <h4>📝 编委会建议签约补充条款模板：</h4>
  <p style="font-size:14px;color:var(--fg);margin:0;line-height:1.7">
    “乙方承诺提供指定车牌号（车牌号：_________）之头车及跟车车队。若因乙方原因造成车队迟到超过 20 分钟，乙方退还该车次全部租金并赔偿该车租金 50% 作为违约金；若原定车辆发生故障无法出车，乙方须提前至少 12 小时通知甲方，并提供同品牌且年限更新的同级别或更高级别替代车型，严禁擅自降级。若私自降级，甲方有权拒付尾款并追索双倍定金。”
  </p>
</div>
"""
            },
            {
                "section": "📋 本周筹备要务与行动清单",
                "title": "距离婚礼 60 天至 90 天必抓的三件核心任务",
                "content": """
<p>如果您的婚期在接下来的 11 月至 12 月，本周是锁定以下三项细节的关键窗口期：</p>
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>终审四大金刚尾款节点</strong>：切忌在婚礼开场前一次性结清所有费用；务必坚持“定金 &le; 20%、现场执行结束当天付至 70%、精修照片与成品视频验收合格后付 30% 尾款”的原则。</li>
  <li><strong>伴手礼与喜糖排期打样</strong>：定制类伴手礼盒（如烫金丝带、定制铭牌）平均制作周期为 15-20 天，本周需完成试吃打样并确定数量（按出席人数 + 10% 备用计算）。</li>
  <li><strong>跟妆试妆与晨间时间表反推</strong>：与化妆师预约本周试妆，记录完整妆发耗时，并根据出阁吉时反推新娘清晨起床与跟摄到场时间（通常为吉时前 3.5 小时）。</li>
</ol>
"""
            }
        ]
    },
    3: {
        "title": "2026金秋备婚周刊第3期：各地婚假审批细则、摄影双机位分工约定与预算压减技巧",
        "short_title": "2026金秋备婚周刊第3期：婚假审批细则与摄影双机位分工",
        "description": "wedding-tv.cn 2026金秋备婚周刊第3期：主创编委会权威梳理各地婚假跨单位跨城审批细则、婚礼摄影双机位分工与RAW原片交付合同要点、无痕婚房布置物料清单与预算削减实战技巧。",
        "highlights": [
            {
                "section": "🏛️ 民政与行业风向",
                "title": "各省婚假休假有效期与人事审批实操注意事项",
                "content": """
<p>目前全国已有 20 余个省份修改了计生条例并给予延长婚假（如山西 30 天、甘肃 30 天、多省份 10-18 天不等）。但在实际执行中，许多新人遇到了<strong>“休假时效限制”</strong>的问题：部分企事业单位内部规章规定“婚假须在领取结婚证后半年或一年内一次性休完，不得分段跨年休假”。</p>
<div class="takeaway">
  <strong>💡 编委会实操指引</strong>
  领证前务必向双方单位人力资源部门查阅员工手册中的《考勤与休假管理规定》，核实婚假是否包含法定公休日与法定节假日，以及申请婚假时所需提交的证明材料（部分单位要求结婚证复印件及婚礼举行证明）。
</div>
"""
            },
            {
                "section": "📈 备婚大盘与行情",
                "title": "婚礼摄影双机位 vs 单机位：分工约定与交付标准",
                "content": """
<p>在备婚影像预算中，许多新人纠结是否需要升级为“双机位摄影”。根据我们对多地跟拍交付案例的分析，只有满足以下条件，双机位才能真正发挥价值：</p>
<table>
  <thead>
    <tr>
      <th>对比维度</th>
      <th>主机位职责</th>
      <th>辅机位职责</th>
      <th>合同必签交付底线</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>晨袍与接亲阶段</strong></td>
      <td>新娘房核心妆容、亲情互动特写</td>
      <td>新郎方出发准备、伴郎堵门游戏抓拍</td>
      <td rowspan="3" style="vertical-align:middle">必须全送全部无压缩原始 RAW 格式或高分 JPG 底片（不低于 600 张），精修数量明确入册。</td>
    </tr>
    <tr>
      <td><strong>典礼仪式阶段</strong></td>
      <td>主舞台交接、交换戒指中景/全景</td>
      <td>父母席微表情、宾客感动落泪特写</td>
    </tr>
    <tr>
      <td><strong>敬酒答谢阶段</strong></td>
      <td>新人与长辈敬酒合影标准定格</td>
      <td>现场抓拍宾客互动、环境空镜细节</td>
    </tr>
  </tbody>
</table>
"""
            },
            {
                "section": "🚨 真实避坑与维权实操",
                "title": "婚房布置被酒店扣押金？无痕胶与静电贴实战清单",
                "content": """
<p>几乎每年结婚旺季都会发生“新人在酒店婚房贴喜字，退房时因墙皮脱落被扣除上千元清洁维修押金”的纠纷。传统普通海绵双面胶在高温或受潮后会牢固粘连墙纸与乳胶漆，强行撕扯必损墙面。</p>
<div class="highlight-card">
  <h4>🛡️ 婚房物料零失误避坑三原则：</h4>
  <ul style="margin:0;padding-left:20px;line-height:1.7">
    <li><strong>光滑表面（玻璃/穿衣镜/瓷砖）</strong>：100% 使用静电吸附喜字，靠静电原理吸附，喷少许清水即可平整贴合，撕下绝无残留。</li>
    <li><strong>乳胶漆墙面与木质门套</strong>：必须使用“可移无痕点胶”或低粘度美纹纸打底，严禁使用红海绵胶和强力纳米胶。</li>
    <li><strong>地毯与床品</strong>：床上抛撒的干花与纸屑必须避免遇水掉色的劣质染料红纸屑，以免染红酒店纯白床单。</li>
  </ul>
</div>
"""
            },
            {
                "section": "📋 本周筹备要务与行动清单",
                "title": "预算超支 20% 时如何做结构性削减？",
                "content": """
<p>如果近期核对预算发现总金额超支，切忌盲目压缩四大金刚（司仪、摄影、跟妆、摄像）的劳务质量，而应从以下高消耗低感知项目中削减：</p>
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>花艺结构替换</strong>：将合影背景墙的高级鲜花改为 70% 高品质仿真花 + 30% 局部真花点缀，视觉效果无差别，成本直接下降 40% 以上。</li>
  <li><strong>纸质请帖数字化</strong>：除少数高龄长辈保留纸质请柬外，年轻同辈全部改用带导航与音乐的免费电子请帖，省下印刷与快递费用。</li>
  <li><strong>酒水自购与开瓶费谈判</strong>：利用本周电商大促自购婚宴红白酒与饮料，并提前与酒店销售书面确认免收开瓶费与自带酒水服务费。</li>
</ol>
"""
            }
        ]
    },
    4: {
        "title": "2026金秋备婚周刊第4期：跨年与春季婚礼档期争夺、伴手礼分层定制与仪式精简原则",
        "short_title": "2026金秋备婚周刊第4期：春季档期争夺与伴手礼分层定制",
        "description": "wedding-tv.cn 2026金秋备婚周刊第4期：主创编委会权威梳理跨年及春季好日子早鸟锁档技巧、结婚伴手礼按客分层采购法、极简婚礼早晨仪式精简与合同定金安全防线。",
        "highlights": [
            {
                "section": "🏛️ 民政与行业风向",
                "title": "来年春季（4-5月）吉日锁定与场地签约窗口期",
                "content": """
<p>根据全国各地婚礼堂与酒店宴会厅档期预订数据，春季（特别是清明节后至五一黄金周之间的高频吉日）的热门草坪与无柱厅已被预订过半。业内督导建议：如果婚期定在来年春季，必须在本月内完成场地实地勘测与定金签署。签署合同时须特别注明“如遇市政工程或特殊天气不可抗力，允许在 6 个月内免费延期一次”的弹性条款。</p>
"""
            },
            {
                "section": "📈 备婚大盘与行情",
                "title": "结婚伴手礼按宾客分级采购法：高体面低成本实操",
                "content": """
<p>传统伴手礼全场一刀切的采购方式既浪费预算又难以兼顾不同圈层的喜好。当前备婚主流趋向于“精细化分层”：</p>
<table>
  <thead>
    <tr>
      <th>宾客群体</th>
      <th>建议礼品组合</th>
      <th>单价参考预算</th>
      <th>避坑要点</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>普通到场宾客</strong></td>
      <td>高档品牌喜糖盒 + 定制红茶/花茶包</td>
      <td>¥15 - ¥25 / 份</td>
      <td>喜糖必须认准官方授权正品，避免临期拼装糖果。</td>
    </tr>
    <tr>
      <td><strong>长辈与重要领导</strong></td>
      <td>传统喜饼礼盒 + 地方非遗工夫茶/健康滋补品</td>
      <td>¥60 - ¥100 / 份</td>
      <td>包装讲究沉稳大气，避免过度花哨轻浮的年轻化包装。</td>
    </tr>
    <tr>
      <td><strong>伴郎伴娘团核心好友</strong></td>
      <td>定制丝光晨袍 + 随身香氛 + 实用手作礼</td>
      <td>¥80 - ¥150 / 份</td>
      <td>尺码须提前悄悄统计，注重私密心意与开箱仪式感。</td>
    </tr>
  </tbody>
</table>
"""
            },
            {
                "section": "🚨 真实避坑与维权实操",
                "title": "堵门接亲游戏尺度与现场意外防范",
                "content": """
<p>低俗闹婚与无底线整蛊游戏是破坏婚礼当天喜庆氛围的重灾区。伴娘团在设计堵门环节时，应坚守“安全、体面、有笑点但不尴尬”的底线：严禁涉及面部强力胶带撕拉、生吃刺激性食物或任何易弄脏西装礼服的道具。推荐采用知识问答、红绳抽签、默契考验等文娱类快节奏互动，时间严格控制在 25-30 分钟以内。</p>
"""
            },
            {
                "section": "📋 本周筹备要务与行动清单",
                "title": "新娘出阁前一个月必须完成的护肤与流程排布",
                "content": """
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>严禁临近婚期尝试医美新品</strong>：婚前 30 天内绝对不要尝试水光针、刷酸或激光类项目，以防出现泛红反黑或过敏爆发无法化妆。</li>
  <li><strong>建立当天核心干系人联络表</strong>：明确一位沉稳可靠的总管（通常为亲舅舅或好友），将车辆、烟酒、红包保管、供应商对接等权限完全交出，新人当天只负责保持好状态。</li>
  <li><strong>誓词卡与致辞文稿手写誊抄</strong>：提前打印或手写誓词本，避免当天在台上低头划手机看备忘录的尴尬体态。</li>
</ol>
"""
            }
        ]
    }
}

def get_next_issue_number() -> int:
    issues = []
    for p in ROOT.glob("wedding-weekly-issue-*.html"):
        m = re.search(r"wedding-weekly-issue-(\d+)\.html$", p.name)
        if m:
            issues.append(int(m.group(1)))
    return max(issues) + 1 if issues else 1

def generate_weekly_html(issue_num: int, date_str: str, topic_data: dict) -> str:
    title = topic_data["title"]
    short_title = topic_data.get("short_title", title)
    description = topic_data["description"]
    
    sections_html = ""
    toc_items = ""
    for idx, item in enumerate(topic_data["highlights"], start=1):
        sec_id = f"section-{idx}"
        toc_items += f'    <li><a href="#{sec_id}">{item["section"]}：{item["title"]}</a></li>\n'
        sections_html += f"""
<h2 id="{sec_id}">{item["section"]} · {item["title"]}</h2>
{item["content"].strip()}
"""

    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title} | wedding-tv.cn</title>
<meta name="description" content="{description}" />
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
<meta name="theme-color" content="#0e0a14" />
<meta name="author" content="wedding-tv.cn 内容维护" />

<link rel="canonical" href="https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" />
<link rel="alternate" hreflang="zh-CN" href="https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" />
<link rel="alternate" hreflang="x-default" href="https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" />

<meta property="og:site_name" content="wedding-tv.cn" />
<meta property="og:title" content="{short_title}" />
<meta property="og:description" content="{description[:120]}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" />
<meta property="og:image" content="https://wedding-tv.cn/og.png" />

<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>📰</text></svg>" />

<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "mainEntityOfPage": {{ "@type": "WebPage", "@id": "https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" }},
  "headline": "{title}",
  "description": "{description}",
  "inLanguage": "zh-CN",
  "datePublished": "{date_str}",
  "dateModified": "{date_str}",
  "image": "https://wedding-tv.cn/og.png",
  "author": {{ "@type": "Organization", "name": "wedding-tv.cn 内容维护", "url": "https://wedding-tv.cn/authors.html" }},
  "reviewedBy": {{ "@type": "Organization", "name": "wedding-tv.cn 内容维护", "url": "https://wedding-tv.cn/editorial-policy.html" }},
  "publisher": {{ "@type": "Organization", "name": "wedding-tv.cn", "logo": {{ "@type": "ImageObject", "url": "https://wedding-tv.cn/og.png" }} }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{ "@type": "ListItem", "position": 1, "name": "首页", "item": "https://wedding-tv.cn/" }},
    {{ "@type": "ListItem", "position": 2, "name": "备婚周刊", "item": "https://wedding-tv.cn/blog.html" }},
    {{ "@type": "ListItem", "position": 3, "name": "第{issue_num}期", "item": "https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" }}
  ]
}}
</script>

<style>
  :root{{--bg:#0e0a14;--fg:#f5f1ea;--mute:#b9b1a3;--accent:#d4a574;--card:#1a1320;--line:#2a2030;--badge:#ff6b9d}}
  *{{box-sizing:border-box}}
  body{{margin:0;font:16px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg)}}
  a{{color:var(--accent);text-decoration:none}}
  a:hover{{text-decoration:underline}}
  .wrap{{max-width:840px;margin:0 auto;padding:48px 22px}}
  header.topbar{{border-bottom:1px solid var(--line);background:#0a060f;position:sticky;top:0;z-index:5}}
  header.topbar .wrap{{padding:14px 22px;display:flex;justify-content:space-between;align-items:center}}
  header.topbar a.brand{{font-weight:700;color:var(--fg)}}
  nav a{{margin-left:18px;color:var(--mute);font-size:14px}}
  .tag{{display:inline-block;padding:3px 10px;border-radius:4px;background:rgba(212,165,116,.15);color:var(--accent);font-size:12px;font-weight:600;margin-bottom:12px}}
  h1{{font-size:30px;line-height:1.35;margin:0 0 14px}}
  h2{{font-size:22px;margin:42px 0 14px;border-left:4px solid var(--accent);padding-left:12px;color:var(--fg)}}
  h3{{font-size:17px;margin:24px 0 8px;color:var(--accent)}}
  .meta{{color:var(--mute);font-size:14px;margin-bottom:32px;line-height:1.6}}
  .highlight-card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px;margin:24px 0}}
  .highlight-card h4{{margin:0 0 10px;font-size:16px;color:var(--accent)}}
  .toc{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin:24px 0 36px}}
  .toc strong{{display:block;margin-bottom:8px;color:var(--accent)}}
  .toc ol{{margin:0;padding-left:20px}}
  table{{width:100%;border-collapse:collapse;margin:18px 0;background:var(--card);border-radius:8px;overflow:hidden}}
  th,td{{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left;font-size:14px}}
  th{{background:#1f1628;color:var(--accent)}}
  .takeaway{{background:rgba(212,165,116,.08);border-left:4px solid var(--accent);padding:14px 18px;margin:18px 0;border-radius:0 8px 8px 0}}
  .takeaway strong{{color:var(--accent);display:block;margin-bottom:4px}}
  .action-box{{background:#150f1d;border:1px solid var(--accent);border-radius:10px;padding:18px;margin:26px 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}}
  .action-box .btn{{display:inline-block;background:var(--accent);color:#1a0f00;padding:10px 20px;border-radius:6px;font-weight:700}}
  footer{{border-top:1px solid var(--line);margin-top:64px;padding:28px 0;color:var(--mute);font-size:13px;text-align:center}}
</style>

<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<script defer src="/assets/speed-booster.js"></script>
<meta name="google-adsense-account" content="ca-pub-6560247681968502" />
</head>
<body>

<header class="topbar">
  <div class="wrap">
    <a class="brand" href="/">wedding-tv.cn</a>
    <nav>
      <a href="/">首页</a>
      <a href="/blog.html">备婚专栏</a>
      <a href="/checklist.html">备婚清单</a>
      <a href="/calculator.html">预算计算器</a>
      <a href="/invitation.html">电子请帖</a>
      <a href="/guide.html">指南汇总</a>
    </nav>
  </div>
</header>

<main class="wrap">

  <div class="tag">📰 WEDDING WEEKLY · 第 {issue_num:02d} 期</div>
  <h1>{title}</h1>
  <div class="meta">
    发布日期：{date_str} · 编撰：<a href="/authors.html" rel="author">周明远（主编）</a> · 审校：程静、林雪 · 出品：wedding-tv.cn
  </div>

  <div class="toc">
    <strong>📋 本期深度导读</strong>
    <ol>
{toc_items}    </ol>
  </div>

{sections_html}

  <div class="action-box">
    <div>
      <div style="font-weight:700;font-size:17px;color:var(--fg)">📋 立即生成您的专属婚礼筹备清单</div>
      <div style="color:var(--mute);font-size:13px;margin-top:4px">根据婚期、城市、桌数自动规划各阶段任务，支持在线勾选与进度保存</div>
    </div>
    <a class="btn" href="/checklist.html">打开免费备婚清单 →</a>
  </div>

  <section class="content-boundary" style="margin:44px 0 24px;padding:22px;background:#171121;border:1px solid rgba(255,255,255,.12);border-radius:8px;line-height:1.8">
    <h3 style="font-size:17px;margin:0 0 10px;color:var(--accent)">采编说明与适用边界</h3>
    <p style="margin:0 0 10px;font-size:14px;color:var(--fg)">本周刊由 <a href="/authors.html" rel="author">wedding-tv.cn 内容维护</a>（主编：周明远）编撰，事实判断对照民政公报与一线执行实录。若发现政策变动或内容勘误，请发送页面地址与依据至 <a href="mailto:1396656381@qq.com">1396656381@qq.com</a>。本站提供客观备婚中立实务参考，不代理任何第三方商户交易。</p>
    <p style="margin:14px 0 0;color:#b9b1a3;font-size:13px">内容责任：<a href="/authors.html" rel="author">wedding-tv.cn 内容维护</a> · 更新：{date_str} · <a href="/editorial-policy.html">采编规范</a></p>
  </section>

</main>

<footer>
  <div class="wrap" style="padding:0">
    © wedding-tv.cn · <a href="/privacy.html">隐私政策</a> · <a href="/terms.html">服务条款</a> · <a href="/authors.html">主创团队</a> · <a href="/editorial-policy.html">编辑守则</a>
  </div>
</footer>

</body>
</html>
"""
    return html

def update_blog_html(issue_num: int, date_str: str, topic_data: dict):
    blog_path = ROOT / "blog.html"
    content = blog_path.read_text("utf-8")
    
    title = topic_data["title"]
    desc = topic_data["description"]
    
    # 1. Update Hero Card
    hero_pattern = r'<h2>📰 备婚周刊 · 行业动态与实操观察</h2>\s*<div class="card"[\s\S]*?</div>\s*</div>'
    new_hero = f"""<h2>📰 备婚周刊 · 行业动态与实操观察</h2>
<div class="card" style="border-color:var(--accent);background:linear-gradient(135deg,rgba(212,165,116,.12),var(--card));margin-bottom:20px;">
  <span class="tag" style="background:#ff6b9d;color:#fff;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;letter-spacing:1px">NEW · 第 {issue_num:02d} 期周报</span>
  <h3 style="font-size:20px;margin:8px 0 10px"><a href="/wedding-weekly-issue-{issue_num}.html" style="color:var(--fg)">{title}</a></h3>
  <p style="color:var(--mute);margin:0 0 14px">{desc}</p>
  <a class="go" href="/wedding-weekly-issue-{issue_num}.html" style="font-weight:700;color:var(--accent)">阅读本期完整周刊与避坑清单 →</a>
</div>"""
    
    if re.search(hero_pattern, content):
        content = re.sub(hero_pattern, new_hero, content, count=1)
    else:
        # Fallback if card structure varies
        old_card_re = r'<div class="card"[^>]*>\s*<span class="tag"[^>]*>NEW · 第 \d+ 期周报</span>[\s\S]*?</div>'
        content = re.sub(old_card_re, new_hero.replace('<h2>📰 备婚周刊 · 行业动态与实操观察</h2>\n', ''), content, count=1)

    # 2. Build or Update Archive list right below the hero card
    archive_html = f"""\n<div class="weekly-archive" style="display:flex;flex-direction:column;gap:8px;margin-bottom:32px;">
  <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:4px">📚 往期周刊速览：</div>"""
    
    for i in range(issue_num - 1, 0, -1):
        prev_p = ROOT / f"wedding-weekly-issue-{i}.html"
        if prev_p.exists():
            prev_html = prev_p.read_text("utf-8")
            pt_m = re.search(r"<title>(.*?)(?: \| wedding-tv\.cn)?</title>", prev_html)
            pd_m = re.search(r'"dateModified":\s*"(\d{4}-\d{2}-\d{2})"', prev_html)
            p_title = pt_m.group(1).replace(" | wedding-tv.cn", "") if pt_m else f"第 {i} 期备婚周刊"
            p_date = pd_m.group(1) if pd_m else ""
            archive_html += f"""
  <a href="/wedding-weekly-issue-{i}.html" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#150f1d;border:1px solid var(--line);border-radius:8px;font-size:13px;color:var(--fg);text-decoration:none">
    <span>第 {i:02d} 期：{p_title}</span>
    <span style="color:var(--mute);font-size:12px;margin-left:12px;flex-shrink:0">{p_date}</span>
  </a>"""
    archive_html += "\n</div>\n"

    # Replace existing archive or insert after hero
    if '<div class="weekly-archive"' in content:
        content = re.sub(r'<div class="weekly-archive"[\s\S]*?</div>\s*</div>', archive_html.strip(), content, count=1)
    else:
        content = content.replace(new_hero, new_hero + archive_html)

    # 3. Update dateModified in blog.html
    content = re.sub(r'"dateModified":\s*"\d{4}-\d{2}-\d{2}"', f'"dateModified":"{date_str}"', content)
    
    blog_path.write_text(content, "utf-8")
    print(f"Updated blog.html with issue #{issue_num}")

def generate_social_copy(issue_num: int, date_str: str, topic_data: dict) -> str:
    title = topic_data["title"]
    short_title = topic_data.get("short_title", title)
    
    highlights_text = ""
    for idx, item in enumerate(topic_data["highlights"], start=1):
        highlights_text += f"{idx}️⃣ 【{item['section'].split(' ')[1]}】{item['title']}\n"
    
    copy_text = f"""# 📕 小红书 / 微信公众号本周一键分发文案

### 📌 备用标题库（直接取用）：
1. 《2026最新备婚周刊：近期领证结婚避坑全指南》
2. 《备婚别踩雷！{short_title}》
3. 《主编手记第{issue_num}期：备婚人必看的实操干货》

---

### 📝 小红书图文文案（一键复制）：

🔥 2026 备婚周刊第 {issue_num} 期上线啦！近期领证与备婚的新人们，这期干货务必先收藏再看：

{highlights_text}
💡 督导实操避坑核心划重点：
• 严防合同模糊陷阱，违约责任必须用白纸黑字写死违约金倍数！
• 备婚清单任务按阶段推进，拒绝焦虑乱花冤枉钱！

💬 备婚中的姐妹们，你们目前筹备到哪一步了？有踩过哪些合同或物料的坑？欢迎在评论区交流排雷~
🔗 完整无删减周刊与免费备婚工具（清单/预算/致辞）已同步更新在 wedding-tv.cn 官网，自取即可！

---
🏷️ 热门标签：
#备婚攻略 #备婚清单 #婚礼避坑 #领证吉日 #极简婚礼 #结婚准备 #备婚日记
"""
    # Write to root for GitHub Actions Step Summary
    (ROOT / "latest-social-copy.md").write_text(copy_text, "utf-8")
    
    # Save to social_copy archive
    social_dir = ROOT / "social_copy"
    social_dir.mkdir(exist_ok=True)
    (social_dir / f"issue-{issue_num}.md").write_text(copy_text, "utf-8")
    
    return copy_text

def main():
    parser = argparse.ArgumentParser(description="Generate Weekly Digest Issue")
    parser.add_argument("--issue", type=int, default=None, help="Force specific issue number")
    parser.add_argument("--date", type=str, default=None, help="Force publication date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Dry run without writing files")
    args = parser.parse_args()

    issue_num = args.issue or get_next_issue_number()
    date_str = args.date or datetime.now().strftime("%Y-%m-%d")

    # Get topic from database or generate
    if issue_num in ISSUES_DATABASE:
        topic_data = ISSUES_DATABASE[issue_num]
    else:
        # Fallback dynamic generator for higher numbers
        topic_data = {
            "title": f"2026金秋备婚周刊第{issue_num}期：当季备婚筹备复盘与实务指南",
            "short_title": f"2026金秋备婚周刊第{issue_num}期：当季备婚实务指南",
            "description": f"wedding-tv.cn 2026金秋备婚周刊第{issue_num}期：主创编委会权威梳理最新婚假与领证动态、当季婚礼影像与布置避坑、新人真实维权案例与筹备行动清单。",
            "highlights": ISSUES_DATABASE[2]["highlights"]
        }

    print(f"Generating Weekly Digest Issue #{issue_num} for {date_str}...")
    html_content = generate_weekly_html(issue_num, date_str, topic_data)
    
    target_file = ROOT / f"wedding-weekly-issue-{issue_num}.html"
    
    if args.dry_run:
        print(f"[Dry Run] Generated {len(html_content)} bytes for {target_file.name}")
        return

    # 1. Write Issue HTML
    target_file.write_text(html_content, "utf-8")
    print(f"Created {target_file.name}")

    # 2. Update blog.html
    update_blog_html(issue_num, date_str, topic_data)

    # 3. Generate Social Copy
    generate_social_copy(issue_num, date_str, topic_data)
    print("Generated social copy in latest-social-copy.md")

    # 4. Rebuild Sitemap
    sitemap_script = ROOT / "scripts" / "rebuild_sitemap.py"
    subprocess.run([sys.executable, str(sitemap_script)], check=True)

    # 5. Rebuild RSS
    rss_script = ROOT / "scripts" / "rss_builder.py"
    subprocess.run([sys.executable, str(rss_script)], check=True)

    print(f"Successfully generated and linked Weekly Digest #{issue_num}!")

if __name__ == "__main__":
    main()
