#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wedding-tv.cn 备婚周刊发布工具
- 没有经人工核验的近期热点稿件则正常跳过，不按周凑稿
- 新稿必须通过来源、审核记录、重复事件与正文相似度检查
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
from datetime import date, datetime, timedelta, timezone
from html import escape
from pathlib import Path
from weekly_quality import SkipPublication, approved_news, news_from_html, verify_candidate_unique

ROOT = Path(__file__).resolve().parent.parent

# Historical issues may only be revised in place, never rotated into new issues.
ISSUES_DATABASE = {
    2: {
        "title": "备婚周刊第2期归档：领证材料更正、婚礼灯光试拍与婚车接送约定",
        "short_title": "备婚周刊第2期：领证材料、灯光试拍与婚车接送",
        "description": "本期归档更正内地居民结婚登记材料要求，区分信息核查不一致时的补充证明；并提供宴会厅灯光试拍顺序、婚车接送行程写法及临时加项费用核算示例。内容是政策背景与筹备建议，不是本周新闻、市场报价或法律意见。",
        "highlights": [
            {
                "section": "登记材料更正",
                "title": "内地居民领证不再提交户口簿，信息不一致另行核查",
                "content": """
<p><strong>更正：</strong>旧稿要求上传户口簿、先到派出所更新婚姻状态后才能领证，现撤回这一要求。2025 年 5 月 10 日新规实施后，内地居民的登记材料已简化，户口簿不再是结婚登记所需证件。身份证及相关签字声明仍须按登记机关要求准备。港澳台居民、华侨和外国人的材料不能照搬这一清单。</p>
<p>如果申报身份或婚姻信息与核查结果不一致，应向登记机关询问相应证明要求，而不是一律回户籍地改户口簿。预约放号时间、照片规格和提交入口应查看拟办登记处的办事指南；本站没有核实到统一的“提前 30 天放号、提前 20 天上传”规则，不再保留这些数字。</p>
<p>依据：<a href="https://www.hubei.gov.cn/szyw/202505/t20250511_5645849.shtml" rel="noopener">民政部《婚姻登记“全国通办”政策问答》（湖北省政府转载，2025-05-11）</a>。这是现行办理背景，不是本周新增政策。</p>
"""
            },
            {
                "section": "宴会厅试拍",
                "title": "先让摄影师试拍真实走位，再确定灯光组合",
                "content": """
<p>下面是本站建议的试拍办法，不是灯具行业统一参数。不要把某一个色温数值当作所有场地的合格线；先用婚礼当天计划使用的相机、位置和灯光组合观察成片。</p>
<table><thead><tr><th>试拍位置</th><th>具体动作</th><th>看什么结果</th></tr></thead><tbody>
<tr><td>宴会厅入口</td><td>请一位同伴按入场路线走到交接点，连续拍照并录一段视频。</td><td>人脸是否从亮到暗突变，追光是否跟丢，视频有没有条纹或闪烁。</td></tr>
<tr><td>主舞台</td><td>站在交换戒指的位置，分别开启和关闭彩色氛围灯。</td><td>肤色是否被染色，白色衣物是否过曝，背景屏幕是否影响主体。</td></tr>
<tr><td>父母与宾客席</td><td>在仪式灯光状态下拍摄坐席，再拍台上人物。</td><td>摄影师能否兼顾台上与台下；若不能，明确哪些环节需要补光或换机位。</td></tr>
</tbody></table>
<p>试拍后保存一张满意的画面和对应灯光状态，交给音控与摄影师。设备、灯位、屏幕亮度改变时重新确认，不承诺一组固定参数能解决所有色偏问题。</p>
"""
            },
            {
                "section": "接送行程",
                "title": "把婚车服务写成可核对的路线，不预设赔偿结果",
                "content": """
<p>比“豪华车队一天”更有用的是一张完整行程：每辆车的车型、座位数、集合位置、到达时间、途经点、最终下客点，以及租金已包含的服务时长和里程。未确定车牌时，让对方说明确认时间和换车需经谁同意，不把样车照片直接视为实际交付承诺。</p>
<p>例如上午接亲、下午送长辈回酒店，可能不是同一段服务。把两段之间的等待、停车、高速费、空驶和超时起算方式分别列出，再比较总价。若车辆故障，事先谈好联系顺序、替代车型和乘客分流办法。</p>
<p>旧稿“迟到即退全款并赔 50%、降级即可双倍定金”的写法已删除。责任与金额须结合有效约定及事实判断，本文不保证任何争议结果；需要拟定赔偿条款时请咨询具备资质的专业人士。</p>
"""
            },
            {
                "section": "现场费用算例",
                "title": "把临时加项拆成数量、单价和批准记录",
                "content": """
<p><strong>假设算例，不是市场报价：</strong>原订单 20 桌，现场追加 2 桌，每桌约定 2,000 元，另经确认增加 300 元设备服务费，则加项合计为 2 × 2,000 + 300 = 4,300 元。若设备费原已包含，不应在算例中再计一次；争议费用先单列，不与已确认项目混在同一笔总数里。</p>
<p>使用<a href="/quote-comparison.html">报价对比器</a>或自己的表格时，保留原订单、变更数量、批准人、付款凭证和未决事项。支付阶段按双方协商的交付节点设置，不把某个三段付款比例说成所有婚庆服务的统一规则。</p>
"""
            }
        ]
    },
    3: {
        "title": "备婚周刊第3期归档：摄影双机位分工、照片交付与花艺预算算例",
        "short_title": "备婚周刊第3期：摄影交付与花艺预算核算",
        "description": "本期归档区分双机位分工、RAW文件与成片交付约定，说明如何试贴婚房装饰，并用明确的假设价格演算花艺替换后的费用。没有统一的600张交付底线，也不承诺布置效果相同或固定节省比例；金额仅用于演算，不代表市场行情。",
        "highlights": [
            {
                "section": "摄影排班",
                "title": "双机位先解决不同地点与不同视角，别只购买人数",
                "content": """
<p>双机位是否值得，先看两个无法同时出现的场景：新人分别在两个住处准备，或者仪式台与父母坐席都需要连续记录。如果全天主要在同一小场地，增加第二位摄影师未必比先明确必拍人物、缩短转场更重要。</p>
<p>排班时写清两位摄影师各自开始与结束的地点，谁负责新娘准备、谁跟随新郎出发、到酒店后在哪里汇合。两个人都拍同一个正面画面，并不等于已经覆盖父母反应、入场背影与远景。以下安排是可协商的工作示例，不是行业统一服务标准。</p>
"""
            },
            {
                "section": "照片交付",
                "title": "婚礼摄影双机位 vs 单机位：分工约定与交付标准",
                "content": """
<p>在报价中分别写“人员分工”和“最终文件”。摄影师拍了多少次快门、筛选后交付多少张、精修多少张，是三个不同的数量；文件格式、交付日期、下载期限和备份期限也要单独约定。</p>
<table>
  <thead>
    <tr>
      <th>对比维度</th>
      <th>主机位职责</th>
      <th>辅机位职责</th>
      <th>需协商的交付内容</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>晨袍与接亲阶段</strong></td>
      <td>新娘房核心妆容、亲情互动特写</td>
      <td>新郎方出发准备、伴郎堵门游戏抓拍</td>
      <td rowspan="3" style="vertical-align:middle">约定筛选成片与精修数量、JPG分辨率、交付日期和修改次数；需要 RAW 时另问是否提供、是否收费及如何使用。不设统一张数底线。</td>
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
<p>“原片全送”要进一步说明是否排除误触、失焦、闭眼和测试画面。RAW 不是可直接浏览的统一成片格式，也不自动包含在每个摄影套餐中。收片时按约定的文件夹、数量和格式抽查，不因为旧稿中的“600 张”就认定服务已经达标或违约。</p>
"""
            },
            {
                "section": "婚房装饰",
                "title": "婚房布置被酒店扣押金？无痕胶与静电贴实战清单",
                "content": """
<p>装饰能否粘贴，先看酒店允许的表面和材料。不能只凭包装上的“无痕”二字判断安全；墙面涂层、老化程度、贴附时间及拆除方式不同，结果可能不同。没有获得允许时，改用独立支架或桌面摆件，不把试贴成功当作全屋都可贴的证明。</p>
<div class="highlight-card">
  <h4>婚房装饰试贴与拆除办法</h4>
  <ul style="margin:0;padding-left:20px;line-height:1.7">
    <li><strong>玻璃与镜面</strong>：先清洁一小块不显眼的位置，按产品说明贴附、拆除；带镀膜或特殊涂层的表面仍需征得许可。</li>
    <li><strong>墙纸、乳胶漆与木饰面</strong>：避免直接粘贴；确需使用时让酒店确认可用材料与试贴位置，移除时发现起皮就停止。</li>
    <li><strong>地毯与床品</strong>：不散撒可能掉色的纸屑或花瓣；收拾前后拍照，装饰物集中装袋带走，发现污损及时告知酒店。</li>
  </ul>
</div>
"""
            },
            {
                "section": "预算演算",
                "title": "花艺替换是否省钱，用同口径明细算一次",
                "content": """
<p><strong>假设算例，不是报价或实测：</strong>同一背景墙，方案甲花材 4,000 元、结构运输与人工 2,000 元，总计 6,000 元。方案乙替换部分花材后花材 2,400 元，但多了 300 元租赁清洁费，其余不变，总计 4,700 元。差额 1,300 元，约为原方案的 21.7%。如果新增运输、押金损耗或更换结构，还要继续计入。</p>
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>保持比较范围一致</strong>：背景墙尺寸、覆盖密度、安装时长与撤场要求相同，才适合比较差价，不能拿局部样板价对比完整搭建价。</li>
  <li><strong>现场看材料</strong>：分别观察近距离触感、远景照片和场地灯光下的颜色；接受效果差异后再决定，不承诺真假花视觉无差别。</li>
  <li><strong>先删不需要的项目</strong>：取消没人使用的合影装置或重复花艺点位，再讨论材料替换。真实节省额按最终订单计算，不能把演算比例当作保证。</li>
</ol>
<p>合同背景参考：<a href="https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_60fb3863b7364b759123a42d1df568ca.html" rel="noopener">国家市场监督管理总局公开《民法典》合同编</a>。上面的排班、文件清单和预算数字是本站建议或假设，不是法律规定的摄影套餐标准。</p>
"""
            }
        ]
    },
    4: {
        "title": "备婚周刊第4期归档：场地档期询价、伴手礼数量与简化仪式安排",
        "short_title": "备婚周刊第4期：档期询价、伴手礼与简化仪式",
        "description": "本期归档撤回无来源的全国场地预订比例与催付定金建议，说明如何向具体场地询问档期、试算伴手礼数量与包装预算，以及删减重复仪式的办法。预算为假设示例，档期与条款以实际书面确认及适用规则为准，不是行业统计或最新新闻。",
        "highlights": [
            {
                "section": "场地询价",
                "title": "具体日期向具体场地核实，不用全国比例催单",
                "content": """
<p><strong>更正：</strong>本站没有支持“全国热门场地预订过半”的数据，也没有统一要求新人“本月必须交定金”的依据，旧稿相应说法撤回。某一家场地说档期紧张，不能推导为全国或全城都没有选择。</p>
<p>给候选场地发送相同条件：日期及可接受备选日、午宴或晚宴、预计人数、仪式与用餐是否同场、布置进场和撤场时间。请对方说明当前是可售、临时保留还是已签约，保留到哪一天，是否与其他活动共用前厅或停车区。每次回复保留时间戳，过期后重新确认。</p>
<p>改期安排应逐项谈：可选日期范围、已发生费用、换厅差价、外包供应商能否同步更换。市政施工、天气变化是否影响合同履行，不能仅凭本站一句话认定一律免费延期。本文不提供自动生效的法律条款。</p>
"""
            },
            {
                "section": "伴手礼预算",
                "title": "按携带与饮食需要选伴手礼，先算份数再做包装",
                "content": """
<p>伴手礼可以按成人、儿童、食品过敏与长途携带需要区分，不必按宾客职位分等级。下面只是选品思路与自定预算示例，不是市场均价，也没有“高档”品牌保证。</p>
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
      <td><strong>成人宾客</strong></td>
      <td>独立包装糖果或茶包，先问是否需要食品类礼物</td>
      <td>¥15 - ¥25 / 份</td>
      <td>喜糖必须认准官方授权正品，避免临期拼装糖果。</td>
    </tr>
    <tr>
      <td><strong>长途携带宾客</strong></td>
      <td>轻便、不易碎、无需冷藏的小包装，不暗示滋补功效</td>
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
<p><strong>数量演算：</strong>假设按家庭送礼，已确认 80 户，另给协助人员 8 份，再自行预留 4 份，则采购 92 份；如果一份礼物 20 元、包装 3 元，合计 92 × 23 = 2,116 元。按人发还是按户发要先决定，不能用宴席人数直接代替礼盒数量。上述金额均为自拟预算，尚未包含运费与定制费。</p>
"""
            },
            {
                "section": "接亲取舍",
                "title": "堵门接亲游戏尺度与现场意外防范",
                "content": """
<p>接亲游戏不是必选环节。想保留时，先问新人和参与者是否愿意，用答题、读信或合影代替强迫进食、身体捆绑和涂抹衣物。约定一句停止口令，任何人提出停止都结束，不以红包数额决定能否离开。门口、楼梯与消防通道不设置障碍。</p>
<p>若晨间只有很短空档，直接取消游戏，把时间留给吃早餐、整理衣物和与父母合影。不要一边保留全部节目，一边要求车辆、摄影和化妆各自“压缩一点”；删掉明确的一个环节，比让所有人同时赶时间更容易执行。</p>
"""
            },
            {
                "section": "简化流程",
                "title": "简化早晨流程：合并重复仪式，保留个人决定权",
                "content": """
<ol style="padding-left:20px;line-height:1.8">
  <li><strong>茶礼不重复摆拍</strong>：若家中已经完成茶礼，可将宴会厅对应节目改为简短致谢，不要求长辈再走一遍同样流程。</li>
  <li><strong>把协助权限说清</strong>：亲友可以联络车辆或核对到场人数；新增支出、身份材料和账户密码仍由本人决定，不以“总管负责”要求交出手机与支付权限。</li>
  <li><strong>誓词准备两个载体</strong>：纸质手卡为主、手机文档备用；提前按自己的语速读一遍，删去不想公开的个人信息，无需为凑时长重复致辞。</li>
</ol>
<p>定金与其他预付款不要混称。<a href="https://www.stats.gov.cn/gk/tjfg/xgfxfg/202503/t20250312_1958939.html" rel="noopener">《民法典》第 586—588 条</a>对定金效力及相关责任作出规定；“定金超过总价 20% 的部分仍享有同样效力”并不准确。具体付款性质、改期及退款争议应结合合同咨询专业人士，本期不是法律意见。</p>
"""
            }
        ]
    },
    5: {
        "title": "备婚周刊第5期归档：婚宴试菜核对、直播网络测试与试妆约定",
        "short_title": "2026金秋备婚周刊第5期：婚宴试菜核对与婚礼直播网络保障",
        "description": "wedding-tv.cn 2026金秋备婚周刊第5期：梳理婚宴试菜克重标注与备桌开启条款、异地亲友婚礼云直播多机位网络上行测速要点、新娘试妆定金折抵与早妆合同约定，以及婚前30至45天宾客席位编排清单。",
        "highlights": [
            {
                "section": "🍽️ 婚宴与场地核对",
                "title": "婚宴试菜与菜单锁定实务：克重标注、备桌条件与酒水协议",
                "content": """
<p>试菜不只确认“鸿运当头”等菜名，而应问到食材品种、份量、做法和上菜顺序。下面是本站建议的核对方向，不是某个月的消费调查或酒店统一标准。试菜结束后，把实际同意的菜单与变更写进订单，更多签约问题可对照<a href="/wedding-vendor-contract-guide.html">《婚庆与酒店合同签约核对指南》</a>与<a href="/wedding-budget-planning-guide.html">《婚礼预算分配指南》</a>。</p>
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
        "title": "备婚周刊第6期归档：影像交付核对、家庭分歧沟通与礼服押金",
        "short_title": "2026深秋备婚周刊第6期：影像成片验收与双方家庭沟通调解",
        "description": "wedding-tv.cn 2026深秋备婚周刊第6期：详解双方父母在桌数、礼金与改口茶礼上的沟通原则，梳理婚礼摄影摄像原片与成片交付验收表，拆解婚纱租赁押金定损防坑要点与婚前两周流程时间轴彩排。",
        "highlights": [
            {
                "section": "🤝 家庭协同与礼俗沟通",
                "title": "双方家庭筹备分歧调解：酒席桌数、礼金归属与改口敬茶沟通原则",
                "content": """
<p>筹备分歧可以先由各自与熟悉的家人沟通，再安排共同讨论；这只是可选办法，不要求任何一方必须“说服”父母或独自承担安抚责任。先说出愿意承担的费用和不接受的要求，再讨论桌数、礼金和仪式，不用职位或性别分配决定权。</p>
<div class="takeaway">
  <strong>💡 三大高频分歧协商路径（完整话术详见<a href="/wedding-family-communication-guide.html">《婚礼双方父母沟通指南》</a>与<a href="/wedding-customs-verification-guide.html">《地方婚俗核对指南》</a>）</strong>
  • <strong>酒席桌数与超桌账目</strong>：若两家合办一场婚宴，建议按“共同基础费用（婚庆布置+四大金刚）平摊或专款支出，酒席餐费按男方桌数与女方桌数各自结算、礼金各自收取”的方式清晰切分；<br />
  • <strong>改口敬茶红包</strong>：金额由赠与者自行决定，也可以不设置，不将示例中的吉利数字当作最低要求；不在台上展示和比较金额。<br />
  • <strong>传统礼俗与现代流程</strong>：分别确认家庭实际保留哪些环节、在何时何地进行，不能把上头、敬茶与回门当成可随意合并的一组固定节目。
</div>
"""
            },
            {
                "section": "🎬 影像交付与质量验收",
                "title": "婚礼摄影摄像成片交付验收标准：底片数量、色温还原与音频底噪核查",
                "content": """
<p>收到成片后，先拿出双方确认的交付约定，再检查数量、格式、声音与修改范围。下表是验收参考，不是法律或行业统一标准；旧稿“单机位至少 400 张、双机位至少 800 张”的说法撤回。详细步骤见<a href="/wedding-photo-video-delivery-guide.html">《婚礼摄影摄像交付验收指南》</a>，服务范围可用<a href="/quote-comparison.html">供应商报价对比器</a>整理。</p>
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
      <td>对照约定的筛选照片数量、文件格式、服务时段和必拍人物，不以机位数推算统一交付张数</td>
      <td>漏拍双方父母合影、长辈敬酒闭眼废片率过高、JPG 底片被过度压缩</td>
      <td>检查约定尺寸的 JPG；只有约定提供 RAW 时才将其纳入验收</td>
    </tr>
    <tr>
      <td><strong>精修照片成片</strong></td>
      <td>与约定样片和修图范围比较肤色、衣物细节与背景处理，不因个人偏好要求无限次修改</td>
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
      <td>按合同约定的网盘、硬盘或其他介质交付，确认下载有效期及备份方式</td>
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
<p>租礼服时把租金、定金与押金分别记下，核对各自金额、用途和退还条件；本站没有可支持统一押金区间的市场调查。取件时已有的勾丝、污迹或配件缺失要拍照记录，归还时逐项对照；发生争议不代表某个固定赔偿比例必然适用。</p>
<div class="highlight-card">
  <h4>礼服取还的记录与确认办法</h4>
  <ul style="margin:0;padding-left:20px;line-height:1.7">
    <li><strong>提裙当面视频验纱</strong>：婚前 1–2 天到店取纱时，与礼服师一起将主纱、秀禾服、敬酒服挂起，用手机录制裙摆底边、拉链扣眼、珠片刺绣的近景视频，将既有微小勾丝批注在取件单上并双方签字。</li>
    <li><strong>问清定损方法</strong>：普通清洁是否包含、什么损伤要修复、按维修费还是其他依据计价、发生争议如何复核，均需事先协商。不要把某个网纱勾丝长度或租金百分比当作通用免责条款。</li>
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
        "title": "备婚周刊第7期归档：冬季迎宾动线、婚礼音乐排布与现场应急预案",
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
    <li><strong>按实际交付协商付款节点</strong>：司仪现场服务与摄影后期交付不同，不能套用同一付款表。明确预付款性质、现场验收和成片交付对应的金额；定金的法律效力限额参见<a href="https://www.stats.gov.cn/gk/tjfg/xgfxfg/202503/t20250312_1958939.html" rel="noopener">《民法典》第 586 条</a>，旧稿“定金 20%–30%”已撤回，具体争议请咨询专业人士。</li>
    <li><strong>有人核单，本人确认支付</strong>：可请可信亲友整理票据和核对订单，但不交出支付密码、身份材料或账户权限。新增费用先记录项目、数量、单价和提出人，由有权决定的人确认，争议项目与已确认项目分开处理。</li>
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
    """Include near duplicates and long copied paragraphs, not just identical hashes."""
    published = {}
    for num in get_existing_issue_numbers():
        if up_to is not None and num > up_to:
            continue
        p = ROOT / f"wedding-weekly-issue-{num}.html"
        html = p.read_text("utf-8")
        verify_candidate_unique(html, published, news_from_html(html))
        published[p.name] = html

def generate_weekly_html(issue_num: int, date_str: str, topic_data: dict, modified: str | None = None) -> str:
    title = topic_data["title"]
    short_title = topic_data.get("short_title", title)
    description = topic_data["description"]
    modified = modified or date_str
    news = topic_data.get("news", [])
    news_html = ""
    for item in news:
        news_html += (f'<h2>{escape(item["title"])}</h2><p>{escape(item["summary"])}</p>'
                      f'<p>来源发布日期：{escape(item["published_at"])} · '
                      f'<a href="{escape(item["url"], quote=True)}" rel="noopener">查看一手来源</a></p>\n')
    news_record = json.dumps(news, ensure_ascii=False).replace("<", "\\u003c")
    status_text = ("热点发布：来源与事件已按本期审阅记录核对；没有新热点时不出刊。" if news else
                   "历史实务归档，不作为当周热点新闻或行情快报。旧文修订保留原发布日期，不新增期数。")
    
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
<title>{escape(title)} | wedding-tv.cn</title>
<meta name="description" content="{escape(description, quote=True)}" />
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
<meta name="theme-color" content="#0e0a14" />
<meta name="author" content="wedding-tv.cn 内容维护" />

<link rel="canonical" href="https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" />
<link rel="alternate" hreflang="zh-CN" href="https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" />
<link rel="alternate" hreflang="x-default" href="https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html" />

<meta property="og:site_name" content="wedding-tv.cn" />
<meta property="og:title" content="{escape(short_title, quote=True)}" />
<meta property="og:description" content="{escape(description[:120], quote=True)}" />
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
  "headline": {json.dumps(title, ensure_ascii=False)},
  "description": {json.dumps(description, ensure_ascii=False)},
  "inLanguage": "zh-CN",
  "datePublished": "{date_str}",
  "dateModified": "{modified}",
  "image": "https://wedding-tv.cn/og.png",
  "author": {{ "@type": "Organization", "name": "wedding-tv.cn 内容维护", "url": "https://wedding-tv.cn/authors.html" }},
  "reviewedBy": {{ "@type": "Organization", "name": "wedding-tv.cn 内容维护", "url": "https://wedding-tv.cn/editorial-policy.html" }},
  "publisher": {{ "@type": "Organization", "name": "wedding-tv.cn", "logo": {{ "@type": "ImageObject", "url": "https://wedding-tv.cn/og.png" }} }}
}}
</script>
<script type="application/json" id="weekly-news-record">{news_record}</script>
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
  header.topbar .wrap{{padding:14px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}}
  header.topbar a.brand{{font-weight:700;color:var(--fg)}}
  nav{{display:flex;flex-wrap:wrap;gap:8px 18px}}
  nav a{{color:var(--mute);font-size:14px}}
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
  table{{width:100%;table-layout:fixed;border-collapse:collapse;margin:18px 0;background:var(--card);border-radius:8px;overflow:hidden}}
  th,td{{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left;font-size:14px;overflow-wrap:anywhere}}
  @media(max-width:600px){{th,td{{padding:8px 6px}}}}
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
  <h1>{escape(title)}</h1>
  <div class="meta">
    发布日期：{date_str} · 更新：{modified} · 编撰：<a href="/authors.html" rel="author">周明远（主编）</a> · 审校：程静、林雪 · 出品：wedding-tv.cn
  </div>
  <p class="weekly-status">{status_text}</p>

  <div class="toc">
    <strong>📋 本期深度导读</strong>
    <ol>
{toc_items}    </ol>
  </div>

{news_html}
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
    <p style="margin:0 0 10px;font-size:14px;color:var(--fg)">本刊由 <a href="/authors.html" rel="author">wedding-tv.cn 内容维护</a>负责，主编周明远。政策判断以正文所列来源及适用范围为准；筹备方案属于本站建议，演算数字不代表市场报价。使用 AI 辅助初稿、结构整理和文字检查，不将模型输出当作事实来源。涉及合同争议时应咨询具备资质的专业人士，本文不构成法律意见。</p>
    <p style="margin:0 0 10px;font-size:14px;color:var(--fg)">没有可核验的新热点不出刊，不用旧指南换标题充当新闻。勘误请发送页面地址与依据至 <a href="mailto:1396656381@qq.com">1396656381@qq.com</a>。</p>
    <p style="margin:14px 0 0;color:#b9b1a3;font-size:13px">内容责任：<a href="/authors.html" rel="author">wedding-tv.cn 内容维护</a> · 更新：{modified} · <a href="/editorial-policy.html">采编规范</a></p>
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
  <span class="tag" style="background:#ff6b9d;color:#fff;border-radius:4px;padding:3px 8px;font-weight:700;font-size:12px">最近归档 · 第 {latest_num:02d} 期</span>
  <p>周刊不固定出刊：只发布有一手来源、经审阅且未报道过的新热点；没有合格新闻就暂停，实务旧文只在原页修订。</p>
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

    content = re.sub(r'"dateModified":\s*"\d{4}-\d{2}-\d{2}"', f'"dateModified":"{beijing_today().isoformat()}"', content)

    blog_path.write_text(content, "utf-8")
    print(f"Updated blog.html with latest issue #{latest_num} and {latest_num - 1} archived issues")

def generate_social_copy(issue_num: int, date_str: str, topic_data: dict) -> str:
    title = topic_data["title"]
    highlights_text = "\n\n".join(
        f"## {item['title']}\n{item['summary']}\n来源（{item['published_at']}）：{item['url']}"
        for item in topic_data["news"]
    )
    copy_text = f"""# {title}

发布日期：{date_str}。以下文案只整理本期已审阅事件，发布到外部平台前仍需检查适用范围。

{highlights_text}

完整解读：https://wedding-tv.cn/wedding-weekly-issue-{issue_num}.html
"""
    # Write to root for GitHub Actions Step Summary
    (ROOT / "latest-social-copy.md").write_text(copy_text, "utf-8")
    
    # Save to social_copy archive
    social_dir = ROOT / "social_copy"
    social_dir.mkdir(exist_ok=True)
    (social_dir / f"issue-{issue_num}.md").write_text(copy_text, "utf-8")
    
    return copy_text

def beijing_today():
    return datetime.now(timezone(timedelta(hours=8))).date()


def main():
    parser = argparse.ArgumentParser(description="Generate Weekly Digest Issue")
    parser.add_argument("--issue", type=int, default=None, help="Force specific issue number")
    parser.add_argument("--date", type=str, default=None, help="Force publication date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Dry run without writing files")
    parser.add_argument("--revise", action="store_true", help="Revise an existing archive in place, never publish a new issue")
    parser.add_argument("--check", action="store_true", help="Check all published weekly bodies for duplication")
    args = parser.parse_args()
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write("published=false\n")

    if args.check:
        verify_all_weekly_issues_unique()
        print("PASS: published weekly issues are not duplicate bodies")
        return
    issue_num = args.issue or get_next_issue_number()
    target_file = ROOT / f"wedding-weekly-issue-{issue_num}.html"
    today = beijing_today()
    date_str = args.date or today.isoformat()
    date.fromisoformat(date_str)
    if args.revise:
        if not target_file.exists() or issue_num not in ISSUES_DATABASE:
            raise ValueError("--revise requires an existing archived issue")
        if args.date:
            raise ValueError("Archive revisions preserve datePublished; do not pass --date")
        topic_data = ISSUES_DATABASE[issue_num]
        old_html = target_file.read_text("utf-8")
        date_str = re.search(r'"datePublished":\s*"(\d{4}-\d{2}-\d{2})"', old_html).group(1)
        news = []
    else:
        if target_file.exists():
            print(f"SKIP: issue #{issue_num} already exists; revise the original instead of republishing")
            return
        draft = ROOT / "weekly-drafts" / f"issue-{issue_num}.json"
        if not draft.exists():
            print(f"SKIP: no reviewed news draft for issue #{issue_num}; no issue or promotional copy generated")
            return
        topic_data = json.loads(draft.read_text("utf-8"))
        try:
            news = approved_news(topic_data, date.fromisoformat(date_str), today)
        except SkipPublication as reason:
            print(f"SKIP: {reason}; no files changed")
            return

    html_content = generate_weekly_html(issue_num, date_str, topic_data, modified=today.isoformat())
    published = {}
    for p in [*ROOT.glob("*.html"), *ROOT.glob("blog/*.html")]:
        if p == target_file:
            continue
        html = p.read_text("utf-8")
        if p.name.startswith("wedding-weekly-issue-") or re.search(r'"@type"\s*:\s*"(?:Article|BlogPosting)"', html):
            published[str(p.relative_to(ROOT))] = html
    verify_candidate_unique(html_content, published, news)
    
    if args.dry_run:
        print(f"[Dry Run] Generated {len(html_content)} bytes for {target_file.name}")
        return

    # 1. Write Issue HTML
    target_file.write_text(html_content, "utf-8")
    print(f"Created {target_file.name}")

    # 3. Update blog.html
    update_blog_html()

    # 4. Generate Social Copy
    if not args.revise:
        generate_social_copy(issue_num, date_str, topic_data)
        print("Generated social copy in latest-social-copy.md")

    # 5. Rebuild Sitemap
    sitemap_script = ROOT / "scripts" / "rebuild_sitemap.py"
    subprocess.run([sys.executable, str(sitemap_script)], check=True)

    # 6. Rebuild RSS
    rss_script = ROOT / "scripts" / "rss_builder.py"
    subprocess.run([sys.executable, str(rss_script)], check=True)

    if os.environ.get("GITHUB_OUTPUT") and not args.revise:
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write("published=true\n")

    print(f"Successfully generated and linked Weekly Digest #{issue_num}!")

if __name__ == "__main__":
    main()
