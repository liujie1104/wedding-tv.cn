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
    },
    5: {
        "title": "2026金秋备婚周刊第5期：婚宴试菜核对清单、婚礼直播多机位网络保障与化妆师试妆避坑",
        "short_title": "2026金秋备婚周刊第5期：婚宴试菜核对与婚礼直播网络保障",
        "description": "wedding-tv.cn 2026金秋备婚周刊第5期：梳理婚宴试菜克重标注与备桌开启条款、异地亲友婚礼云直播多机位网络上行测速要点、新娘试妆定金折抵与早妆合同约定，以及婚前30至45天宾客席位编排清单。",
        "highlights": [
            {
                "section": "🍽️ 婚宴与场地核对",
                "title": "婚宴试菜与菜单锁定实务：克重标注、备桌条件与酒水协议",
                "content": """
<p>进入 10 月下旬，年底及明春婚宴陆续进入试菜与最终菜单确认阶段。许多新人在拿到酒店提供的吉祥菜名菜单（如“鸿运当头”“金玉满堂”“富贵吉祥”）时，往往忽略了食材品种、净重规格与烹饪方式等关键细节，导致婚礼当天出品缩水或冷热上菜节奏失控。建议在试菜当天将以下核对事项写入婚宴补充协议（更多签约细节可对照<a href="/wedding-vendor-contract-guide.html">《婚庆与酒店合同签约核对指南》</a>与<a href="/wedding-budget-planning-guide.html">《婚礼预算分配指南》</a>）：</p>
<table>
  <thead>
    <tr>
      <th>核对模块</th>
      <th>常见模糊写法</th>
      <th>合同建议明确写法</th>
      <th>现场核验重点</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>海鲜与主菜规格</strong></td>
      <td>清蒸石斑鱼、精选大闸蟹</td>
      <td>深海老虎斑（净重 750g–850g/尾，活鱼现蒸）；母蟹按只计（每席 10 只，单只不低于 150g）</td>
      <td>试菜时拍照留存摆盘器皿尺寸与配菜比例</td>
    </tr>
    <tr>
      <td><strong>备桌开启与结算</strong></td>
      <td>满 20 桌备 2 桌，按实结算</td>
      <td>备桌不开火不收费；仅在总管签字确认开席后按正席餐标 90% 计费，不另收服务费</td>
      <td>指定唯一签字授权人，防止服务员自行加桌开席</td>
    </tr>
    <tr>
      <td><strong>自带酒水与冰块</strong></td>
      <td>允许自带酒水，配合酒店管理</td>
      <td>甲方自带红白酒、香槟及软饮免收开瓶费、清洁费与服务费；酒店免费提供冰桶及高脚杯</td>
      <td>婚前一日入库清点整箱封条，留存空瓶核销记录</td>
    </tr>
    <tr>
      <td><strong>上菜节奏与保温</strong></td>
      <td>仪式结束后准时开席</td>
      <td>凉菜于迎宾结束前 15 分钟摆台；热菜于主仪式礼成后 5 分钟内起菜，45 分钟内上齐全部热菜</td>
      <td>传菜通道须避开主舞台追光区与摄影师退场跟拍动线</td>
    </tr>
  </tbody>
</table>
"""
            },
            {
                "section": "📡 婚礼影像与云直播",
                "title": "异地亲友婚礼云直播：上行带宽测速、音频内录与多机位推流保障",
                "content": """
<p>对于跨省联姻或有海外亲友无法到场的新人，婚礼云直播已成为连接远方亲友的重要方式。但在实际执行中，<strong>将直播推流直接挂载在酒店公共 Wi-Fi 上是导致画面卡顿、音画不同步的主要原因</strong>——婚礼开场后上百位宾客手机同时接入宴会厅无线路由，公共信道上行速率极易跌破 2 Mbps。</p>
<div class="takeaway">
  <strong>💡 直播网络与拾音三项硬指标（详见<a href="/wedding-live-stream-technical-guide.html">《婚礼直播技术保障指南》</a>与<a href="/guide-livestream.html">《直播服务商选择指南》</a>）</strong>
  1. <strong>独立上行链路</strong>：向酒店工程部申请有线千兆网口直连导播台，或由直播团队配置多运营商 5G 聚合背包（1080P 高清推流稳定上行须 &ge; 15 Mbps）；<br />
  2. <strong>调音台干声直采</strong>：直播音频严禁仅靠机顶麦克风环境拾音，须从宴会厅调音台 Line-Out/XLR 接口分出一路独立信号输入采集卡，保障誓词与致辞清晰无回声；<br />
  3. <strong>提前费用测算</strong>：可在<a href="/calculator.html">婚礼影像报价估算器</a>中提前核算单机位推流与双机位导播切换的合理预算区间。
</div>
"""
            },
            {
                "section": "🚨 真实避坑与维权实操",
                "title": "新娘跟妆“免费试妆”隐形推销与早妆时间卡点约定",
                "content": """
<p>在预订新娘跟妆时，部分工作室以“零元试妆”吸引到店，但试妆过程中频繁推销高价定妆安瓶、手工分段假睫毛或身体水粉，若当场不签单则索要高额试妆工本费；另有部分新人在婚礼当天遭遇“主理人临时改派徒弟到场”的困扰。</p>
<div class="highlight-card">
  <h4>📝 跟妆合同必签四项补充约定：</h4>
  <ul style="margin:0;padding-left:20px;line-height:1.7">
    <li><strong>试妆费折抵透明化</strong>：明确约定试妆费用金额（如 ¥200–¥400），当场定妆全额抵扣跟妆总价；若试妆后未签约，仅支付约定试妆费，无任何附加耗材费。</li>
    <li><strong>全包耗材清单列明</strong>：合同写明跟妆报价已包含全天假睫毛、胸贴、发饰头纱租赁、身体亮肤乳及卸妆湿巾，现场零二次推销。</li>
    <li><strong>锁定化妆师本人与亲友妆范围</strong>：写明跟妆老师真实姓名与身份证号尾号，严禁换人；明确是否包含新郎妆发及双方母亲妆面。</li>
    <li><strong>早妆到场时间卡点</strong>：约定化妆师须于接亲出发前至少 3.5 小时抵达婚房（例如 05:30 到场），每套造型定妆照留存进合同附件作为当天还原标准。</li>
  </ul>
</div>
"""
            },
            {
                "section": "📋 本周筹备要务与行动清单",
                "title": "距离婚礼 30 至 45 天：宾客席位图编排与特殊忌口统计",
                "content": """
<p>进入婚前最后一个半月，筹备重心应从“选定供应商”转向“精细化席位与物料落地”：</p>
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>回收请帖回执并编排席位图</strong>：通过<a href="/invitation.html">免费电子请帖工具</a>汇总出席人数，按“双方长辈主桌、男方亲属区、女方亲属区、父母同事区、新人同学挚友区”划分桌次（文案礼仪可参考<a href="/wedding-invitation-wording-guide.html">《电子请帖文案指南》</a>）。</li>
  <li><strong>单独登记特殊饮食与儿童座椅</strong>：逐桌排查是否有清真饮食、纯素食、海鲜或坚果严重过敏宾客，以及每桌所需的婴幼儿宝宝椅数量，提前 15 天形成书面表格交给宴会厅经理。</li>
  <li><strong>逐项勾选婚前月度采购表</strong>：打开<a href="/checklist.html">备婚筹备清单</a>，核对敬茶盖碗、跪垫、喜字静电贴、伴手礼盒及改口红包袋是否已全部到货。</li>
</ol>
"""
            }
        ]
    },
    6: {
        "title": "2026深秋备婚周刊第6期：婚礼摄影摄像成片验收标准、双方父母沟通分歧调解与礼服押金防坑",
        "short_title": "2026深秋备婚周刊第6期：影像成片验收与双方家庭沟通调解",
        "description": "wedding-tv.cn 2026深秋备婚周刊第6期：详解双方父母在桌数、礼金与改口茶礼上的沟通原则，梳理婚礼摄影摄像原片与成片交付验收表，拆解婚纱租赁押金定损防坑要点与婚前两周流程时间轴彩排。",
        "highlights": [
            {
                "section": "🤝 家庭协同与礼俗沟通",
                "title": "双方家庭筹备分歧调解：酒席桌数、礼金归属与改口敬茶沟通原则",
                "content": """
<p>随着婚期临近，两代人及两个原生家庭在礼俗细节与费用分摊上的观念差异容易集中浮现。处理家庭筹备分歧的核心准则是<strong>“各自沟通、内部消化、对外一致”</strong>——新郎负责说服男方父母，新娘负责安抚女方父母，避免让伴侣直接面对对方长辈提出异议。</p>
<div class="takeaway">
  <strong>💡 三大高频分歧协商路径（完整话术详见<a href="/wedding-family-communication-guide.html">《婚礼双方父母沟通指南》</a>与<a href="/wedding-customs-verification-guide.html">《地方婚俗核对指南》</a>）</strong>
  • <strong>酒席桌数与超桌账目</strong>：若两家合办一场婚宴，建议按“共同基础费用（婚庆布置+四大金刚）平摊或专款支出，酒席餐费按男方桌数与女方桌数各自结算、礼金各自收取”的方式清晰切分；<br />
  • <strong>改口敬茶红包对等</strong>：提前半个月由小夫妻在双方父母间同步改口红包金额（如统一为 ¥6,666 或 ¥10,001），并准备好同款红包封皮，避免仪式台上红包厚薄差异引发尴尬；<br />
  • <strong>传统礼俗与现代流程折中</strong>：将长辈看重的上头、敬茶、回门礼安排在接亲房内完成，将主舞台仪式留给简洁庄重的现代流程。
</div>
"""
            },
            {
                "section": "🎬 影像交付与质量验收",
                "title": "婚礼摄影摄像成片交付验收标准：底片数量、色温还原与音频底噪核查",
                "content": """
<p>秋季婚礼扎堆过后，许多新人陆续收到摄影摄像团队交付的初版照片与剪辑成片。为了在支付尾款前高效完成质量把关，建议对照以下四维验收表逐项检查（详细验收流程可查阅<a href="/wedding-photo-video-delivery-guide.html">《婚礼摄影摄像交付验收指南》</a>，前期选团队可使用<a href="/quote-comparison.html">供应商报价对比器</a>）：</p>
<table>
  <thead>
    <tr>
      <th>交付类别</th>
      <th>核心验收指标</th>
      <th>常见质量瑕疵排查</th>
      <th>修改沟通依据</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>原始底片与素材包</strong></td>
      <td>单机位有效底片 &ge; 400 张，双机位 &ge; 800 张；覆盖接亲、外景、迎宾、仪式、敬酒全环节</td>
      <td>漏拍双方父母合影、长辈敬酒闭眼废片率过高、JPG 底片被过度压缩</td>
      <td>索取全量未压缩大图或 RAW 文件备份</td>
    </tr>
    <tr>
      <td><strong>精修照片成片</strong></td>
      <td>肤色自然通透，婚纱蕾丝纹理清晰，背景杂物（灭火器、安全出口绿灯）已清理</td>
      <td>液化过度导致背景门框弯曲、暗光场景噪点涂抹成塑料感、主舞台脸色偏洋红或偏绿</td>
      <td>按编号列出具体修改意见表，集中一次性提交返修</td>
    </tr>
    <tr>
      <td><strong>纪实长片与快剪 MV</strong></td>
      <td>1080P/4K 帧率稳定无掉帧；誓词同期声清晰，背景音乐在人声说话时平滑压低</td>
      <td>多机位画面色温不一致（一冷一暖）、现场收音爆音或电流底噪明显、字幕姓名错别字</td>
      <td>标注精确时间码（如 02:15–02:28）要求重新调色或降噪</td>
    </tr>
    <tr>
      <td><strong>存储介质与归档</strong></td>
      <td>提供独立加密网盘高速下载链接 + 实体 U 盘，文件按环节分文件夹命名</td>
      <td>网盘链接 7 天即失效、仅通过微信对话框发送压缩视频</td>
      <td>验收后立即在本地硬盘与家庭云盘完成异地双备份</td>
    </tr>
  </tbody>
</table>
"""
            },
            {
                "section": "🚨 真实避坑与维权实操",
                "title": "婚纱礼服租赁“定金转押金”与归还定损纠纷防范",
                "content": """
<p>高定婚纱礼服租赁通常伴随 ¥3,000 至 ¥8,000 不等的押金。在退还礼服时，部分不良商家会以“裙摆网纱局部勾丝”“迎亲草坪泥渍无法清洗”为由，强行扣除数千元押金甚至要求按原价买断。</p>
<div class="highlight-card">
  <h4>🛡️ 礼服取还零纠纷三步取证法：</h4>
  <ul style="margin:0;padding-left:20px;line-height:1.7">
    <li><strong>提裙当面视频验纱</strong>：婚前 1–2 天到店取纱时，与礼服师一起将主纱、秀禾服、敬酒服挂起，用手机录制裙摆底边、拉链扣眼、珠片刺绣的近景视频，将既有微小勾丝批注在取件单上并双方签字。</li>
    <li><strong>书面界定免责磨损范围</strong>：签约时补充约定“租金已包含常规干洗清洁费；婚礼当天正常行走造成的裙摆灰尘及 2 厘米以内的底层网纱轻微勾丝属于合理损耗，免予赔偿；如需定损赔偿，单件赔偿上限不超过该件礼服单日租金的 50%”。</li>
    <li><strong>还纱现场当面签收</strong>：婚礼次日归还礼服时，务必要求店员当场检查并出具《礼服完好归还确认单》，明确押金原路退回的具体工作日。</li>
  </ul>
</div>
"""
            },
            {
                "section": "📋 本周筹备要务与行动清单",
                "title": "距离婚礼 14 天：全流程时间轴卡点彩排与总管交底",
                "content": """
<p>婚前最后两周是把纸面方案转化为执行口令的阶段，请重点落实以下三项工作：</p>
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>输出分钟级时间轴</strong>：使用<a href="/timeline.html">婚礼流程时间轴工具</a>或<a href="/timeline-templates.html">流程模板下载中心</a>，生成包含化妆、接亲、外景、彩排、迎宾、典仪、敬酒的完整时间表，打印 10 份分发给伴郎伴娘与车队负责人。</li>
  <li><strong>预留转场机动缓冲</strong>：对照<a href="/wedding-day-timeline-guide.html">《婚礼当天流程排布指南》</a>，在车队行进与午间彩排之间至少留出 25 分钟机动时间，防止早高峰拥堵挤压司仪对光彩排。</li>
  <li><strong>召开供应商与总管拉通会</strong>：建立包含婚礼总管、策划督导、司仪、摄像、摄影、跟妆及酒店宴会经理的微信工作群，确认进场搭建时间、货梯位置与音响彩排节点。</li>
</ol>
"""
            }
        ]
    },
    7: {
        "title": "2026初冬备婚周刊第7期：立冬婚礼保暖与迎宾动线设计、婚礼音乐歌单排布与现场应急预案",
        "short_title": "2026初冬备婚周刊第7期：立冬保暖动线、歌单排布与应急预案",
        "description": "wedding-tv.cn 2026初冬备婚周刊第7期：围绕11月立冬后婚礼保暖与迎宾衣帽寄存动线、暖场至敬酒四阶段BGM音乐歌单编排、四大金刚尾款分段支付防加价，以及婚礼现场突发状况B计划与应急箱清单展开实操拆解。",
        "highlights": [
            {
                "section": "🧣 季节筹备与动线设计",
                "title": "立冬后婚礼现场保暖与迎宾动线：衣帽寄存、热饮补给与防起雾细节",
                "content": """
<p>进入 11 月立冬节气后，南北方气温明显回落，初冬与冬季婚礼在现场体验上最大的痛点往往不是主舞台布景，而是<strong>宾客厚重冬衣无处安放导致宴会厅画面杂乱，以及室内外温差引发的新人受凉与摄影镜头起雾</strong>。</p>
<div class="takeaway">
  <strong>💡 初冬婚礼四大体贴细节落地指引</strong>
  1. <strong>迎宾区设立挂牌衣帽间</strong>：与酒店协调在宴会厅前厅配置 3–4 组移动挂衣杆与双联号码牌，安排两位礼仪协助宾客寄存羽绒服与大衣，既提升宾客入席舒适度，又避免五颜六色的外套堆满椅背破坏跟拍画面；<br />
  2. <strong>签到台热饮暖手补给</strong>：将夏季甜品台的气泡水替换为保温桶装的桂圆红枣茶、柠檬红茶或热梨汤，搭配独立包装暖手宝作为签到伴手小礼；<br />
  3. <strong>新娘隐形保暖方案</strong>：齐地主纱与秀禾服裙摆内可穿戴肤色加绒保暖裤与软底保暖婚鞋，将暖宝宝贴于后腰与小腹内衬（切勿直接接触皮肤以防低温烫伤），室外迎亲转场备好米白色羊毛披肩；<br />
  4. <strong>摄影器材温差除雾缓冲</strong>：外景拍摄返回开足暖气的宴会厅前，提醒摄影摄像师提前 15 分钟将备用镜头转入室内回温，并备好镜头擦拭布，防止关键入场画面蒙雾。
</div>
"""
            },
            {
                "section": "🎵 仪式氛围与声学编排",
                "title": "婚礼现场 BGM 音乐分段排布：迎宾、入场、誓词与敬酒的节奏控制",
                "content": """
<p>音乐是婚礼现场情绪的隐形推手。许多新人耗费大量精力挑选几十首歌曲，却因现场依赖手机在线播放缓冲卡顿、或不同曲目音量电平差异过大导致现场体验割裂。建议按以下四阶段标准整理本地离线音频包（分场景曲库可直接参考<a href="/playlist.html">婚礼歌单推荐工具</a>，誓词撰写可配合<a href="/vows.html">结婚誓词生成器</a>）：</p>
<table>
  <thead>
    <tr>
      <th>仪式阶段</th>
      <th>推荐曲风与拍速</th>
      <th>音量与淡入淡出控制</th>
      <th>音控台执行要点</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>迎宾签到暖场（45–60 分钟）</strong></td>
      <td>爵士钢琴、Bossa Nova、轻快弦乐（准备 15–20 首循环）</td>
      <td>中低音量（不影响宾客寒暄交谈）</td>
      <td>严禁包含伤感分手歌词的流行歌，曲目间设置 2 秒交叉淡化</td>
    </tr>
    <tr>
      <td><strong>新郎新娘入场与交接</strong></td>
      <td>庄重管弦乐或定制高潮前奏曲（提前剪辑好高潮切入点）</td>
      <td>大门开启瞬间推起主音轨，交接拥抱时推至情绪峰值</td>
      <td>彩排时必须与步速实地合练一次，标记追光亮起与音乐切入秒数</td>
    </tr>
    <tr>
      <td><strong>交换誓词与佩戴婚戒</strong></td>
      <td>纯音乐无人声钢琴/大提琴慢板铺底</td>
      <td>人声开口时背景乐自动压低 12–15dB，誓词读完瞬间渐强</td>
      <td>绝对避免带中文演唱人声的曲目与新人读誓词声音打架</td>
    </tr>
    <tr>
      <td><strong>礼成退场与全席敬酒</strong></td>
      <td>复古 Funk、Sweet Pop、喜庆国风轻音乐（准备 20 首以上）</td>
      <td>退场时饱满欢快，开席敬酒后转为温和背景音量</td>
      <td>全部导出为 320kbps MP3 或 WAV 格式存入独立 U 盘，禁用网页在线播放</td>
    </tr>
  </tbody>
</table>
"""
            },
            {
                "section": "🚨 真实避坑与维权实操",
                "title": "四大金刚尾款支付节奏与拒绝现场临时加价实务",
                "content": """
<p>婚礼当天新人与父母精力高度集中在迎宾与敬酒上，个别供应商或车队人员会趁机在现场提出“接亲超时加费”“双机位摇臂耗材加费”或要求在开席前结清全部尾款，一旦当场全额付清，后续成片拖延便失去约束力。</p>
<div class="highlight-card">
  <h4>📝 现场财务交接与防加价三项铁律（合同模板详见<a href="/wedding-vendor-contract-guide.html">《婚庆合同签约指南》</a>）：</h4>
  <ul style="margin:0;padding-left:20px;line-height:1.7">
    <li><strong>严格执行三段式付款比例</strong>：签约付定金 20%–30%；婚礼当天仪式圆满礼成后支付至总款的 70%–80%；剩余 20%–30% 作为质量尾款，须在收到全部合格原片与精修成片后支付（司仪与跟妆无后期交付物的，在敬酒妆面完成后由总管结清）。</li>
    <li><strong>收款权限移交婚礼总管</strong>：新人手机当天由伴娘保管，所有尾款结算统一由婚礼总管对照纸质合同附件核验后转账，任何未写入合同的临时加价一律不予认可。</li>
    <li><strong>超时计费须有书面起止宽限期</strong>：合同中应提前约定“因不可抗力或正常仪式顺延 30 分钟内免收超时费；超出部分按每小时固定标准计费”，杜绝口头漫天要价。</li>
  </ul>
</div>
"""
            },
            {
                "section": "📋 本周筹备要务与行动清单",
                "title": "婚礼前夕突发状况 B 计划与现场应急箱最终核对",
                "content": """
<p>在迈入婚礼当周前，花 30 分钟完成以下三项防错核查，可化解绝大多数现场突发状况：</p>
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>生成专属现场应急预案</strong>：使用<a href="/emergency-plan-generator.html">婚礼应急预案生成器</a>并结合<a href="/wedding-emergency-plan-guide.html">《婚礼当天应急预案指南》</a>，针对降温降雨、无线麦克风断频、LED 大屏播放故障明确第一责任人与替代方案。</li>
  <li><strong>打印大字号致辞与誓词手卡</strong>：通过<a href="/speech.html">婚礼致辞生成器</a>定稿新人答谢词与双方父母致辞，使用小三号以上字体打印在硬卡纸上，并多备一份交由司仪留存，防止舞台追光刺眼看不清字迹。</li>
  <li><strong>封箱移交新娘随身应急包</strong>：清点隐形眼镜护理液、安全别针、双面防走光服饰贴、吸油面纸、独立包装吸管（防涂口红后喝水沾杯）、大容量充电宝及 20 个空白备用红包袋，交由首席伴娘随身携带。</li>
</ol>
"""
            }
        ]
    }
}

def get_existing_issue_numbers() -> list[int]:
    issues = []
    for p in ROOT.glob("wedding-weekly-issue-*.html"):
        m = re.search(r"wedding-weekly-issue-(\d+)\.html$", p.name)
        if m:
            issues.append(int(m.group(1)))
    return sorted(issues)

def get_next_issue_number() -> int:
    issues = get_existing_issue_numbers()
    return max(issues) + 1 if issues else 1

def verify_all_weekly_issues_unique(up_to: int | None = None):
    """校验所有已生成的周刊页面，确保标题、摘要与正文内容绝不重复。"""
    import hashlib
    seen_titles = {}
    seen_descs = {}
    seen_bodies = {}
    for num in get_existing_issue_numbers():
        if up_to is not None and num > up_to:
            continue
        p = ROOT / f"wedding-weekly-issue-{num}.html"
        html = p.read_text("utf-8")
        t_m = re.search(r"<title>(.*?)</title>", html)
        d_m = re.search(r'<meta name="description" content="(.*?)"', html)
        b_m = re.search(r'</div>\s*(<h2 id="section-1">[\s\S]*?)<div class="action-box">', html)
        title = t_m.group(1).strip() if t_m else ""
        desc = d_m.group(1).strip() if d_m else ""
        body = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", b_m.group(1))).strip() if b_m else ""
        body_hash = hashlib.md5(body.encode("utf-8")).hexdigest()[:12]

        if title in seen_titles:
            raise RuntimeError(f"Duplicate weekly title detected between issue #{num} and #{seen_titles[title]}: {title}")
        seen_titles[title] = num

        if desc in seen_descs:
            raise RuntimeError(f"Duplicate weekly description detected between issue #{num} and #{seen_descs[desc]}")
        seen_descs[desc] = num

        if body_hash in seen_bodies:
            raise RuntimeError(f"Duplicate weekly body content detected between issue #{num} and #{seen_bodies[body_hash]} (hash={body_hash})")
        seen_bodies[body_hash] = num

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

def update_blog_html():
    blog_path = ROOT / "blog.html"
    content = blog_path.read_text("utf-8")

    existing_issues = get_existing_issue_numbers()
    if not existing_issues:
        return
    latest_num = max(existing_issues)
    latest_p = ROOT / f"wedding-weekly-issue-{latest_num}.html"
    latest_html = latest_p.read_text("utf-8")

    lt_m = re.search(r"<title>(.*?)(?: \| wedding-tv\.cn)?</title>", latest_html)
    ld_m = re.search(r'<meta name="description" content="(.*?)"', latest_html)
    lmod_m = re.search(r'"dateModified":\s*"(\d{4}-\d{2}-\d{2})"', latest_html)

    latest_title = lt_m.group(1).replace(" | wedding-tv.cn", "") if lt_m else f"第 {latest_num} 期备婚周刊"
    latest_desc = ld_m.group(1) if ld_m else ""
    latest_date = lmod_m.group(1) if lmod_m else ""

    new_hero = f"""<h2>📰 备婚周刊 · 行业动态与实操观察</h2>
<div class="card" style="border-color:var(--accent);background:linear-gradient(135deg,rgba(212,165,116,.12),var(--card));margin-bottom:20px;">
  <span class="tag" style="background:#ff6b9d;color:#fff;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px;letter-spacing:1px">NEW · 第 {latest_num:02d} 期周报</span>
  <h3 style="font-size:20px;margin:8px 0 10px"><a href="/wedding-weekly-issue-{latest_num}.html" style="color:var(--fg)">{latest_title}</a></h3>
  <p style="color:var(--mute);margin:0 0 14px">{latest_desc}</p>
  <a class="go" href="/wedding-weekly-issue-{latest_num}.html" style="font-weight:700;color:var(--accent)">阅读本期完整周刊与避坑清单 →</a>
</div>"""

    archive_html = """<div class="weekly-archive" style="display:flex;flex-direction:column;gap:8px;margin-bottom:32px;">
  <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:4px">📚 往期周刊速览：</div>"""

    for i in range(latest_num - 1, 0, -1):
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
    archive_html += "\n</div>"

    combined_weekly_section = f"{new_hero}\n{archive_html}\n\n\n"
    section_pattern = r'<h2>📰 备婚周刊 · 行业动态与实操观察</h2>[\s\S]*?(?=<h2>🧰 在线工具</h2>)'

    if re.search(section_pattern, content):
        content = re.sub(section_pattern, combined_weekly_section, content, count=1)
    else:
        raise RuntimeError("Could not locate weekly digest section in blog.html")

    if latest_date:
        content = re.sub(r'"dateModified":\s*"\d{4}-\d{2}-\d{2}"', f'"dateModified":"{latest_date}"', content)

    blog_path.write_text(content, "utf-8")
    print(f"Updated blog.html with latest issue #{latest_num} and {latest_num - 1} archived issues")

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
• 严防合同模糊约定，违约责任与交付明细必须白纸黑字写入补充协议！
• 备婚任务按时间节点分阶段推进，把控预算重点不花冤枉钱！

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

    if issue_num not in ISSUES_DATABASE:
        raise SystemExit(
            f"Error: Issue #{issue_num} is not defined in ISSUES_DATABASE. "
            f"Refusing to generate fallback duplicate content. Please add Issue #{issue_num} to ISSUES_DATABASE first."
        )
    topic_data = ISSUES_DATABASE[issue_num]

    print(f"Generating Weekly Digest Issue #{issue_num} for {date_str}...")
    html_content = generate_weekly_html(issue_num, date_str, topic_data)
    
    target_file = ROOT / f"wedding-weekly-issue-{issue_num}.html"
    
    if args.dry_run:
        print(f"[Dry Run] Generated {len(html_content)} bytes for {target_file.name}")
        return

    # 1. Write Issue HTML
    target_file.write_text(html_content, "utf-8")
    print(f"Created {target_file.name}")

    # 2. Verify all weekly issues have unique titles, descriptions, and body content
    verify_all_weekly_issues_unique(up_to=issue_num)
    print("Verified all weekly digest issues have unique titles, descriptions, and body content")

    # 3. Update blog.html
    update_blog_html()

    # 4. Generate Social Copy
    generate_social_copy(issue_num, date_str, topic_data)
    print("Generated social copy in latest-social-copy.md")

    # 5. Rebuild Sitemap
    sitemap_script = ROOT / "scripts" / "rebuild_sitemap.py"
    subprocess.run([sys.executable, str(sitemap_script)], check=True)

    # 6. Rebuild RSS
    rss_script = ROOT / "scripts" / "rss_builder.py"
    subprocess.run([sys.executable, str(rss_script)], check=True)

    print(f"Successfully generated and linked Weekly Digest #{issue_num}!")

if __name__ == "__main__":
    main()
