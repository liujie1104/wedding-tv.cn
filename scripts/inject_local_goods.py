import os
import re

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"
UNION_ID = "2038503768"

PROVINCE_GOODS = {
    "guangdong.html": {
        "title": "广东传统婚俗 · 提亲茶礼与嫁女喜饼甄选",
        "items": [
            {"icon": "🥮", "name": "广式传统嫁女喜饼大礼盒（绫酥对装）", "desc": "非遗传承·广府提亲礼饼·红绫黄绫传统喜意", "price": "¥68.0 起", "kw": "广式传统嫁女喜饼大礼盒"},
            {"icon": "🍵", "name": "潮汕凤凰单丛提亲工夫茶礼盒", "desc": "高山蜜兰香·潮汕敬茶三礼·传统工夫茶对装", "price": "¥128.0 起", "kw": "潮汕工夫茶礼盒提亲"}
        ]
    },
    "zhejiang.html": {
        "title": "浙江传统婚俗 · 西湖茶礼与绍兴喜酒甄选",
        "items": [
            {"icon": "🍵", "name": "杭州西湖龙井高档提亲茶礼盒", "desc": "明前特级·江南以茶为媒·端庄大气提亲礼", "price": "¥158.0 起", "kw": "西湖龙井茶礼盒提亲"},
            {"icon": "🍶", "name": "绍兴花雕封坛手工黄酒（婚宴定制对坛）", "desc": "女儿红传统·手工冬酿·婚宴上席与回门好礼", "price": "¥99.0 起", "kw": "绍兴花雕婚宴封坛黄酒"}
        ]
    },
    "fujian.html": {
        "title": "福建传统婚俗 · 闽南敬茶与大红袍伴手礼甄选",
        "items": [
            {"icon": "🍵", "name": "安溪铁观音提亲茶礼盒（传统对装）", "desc": "兰花香正味·闽南提亲过礼·新人敬茶标配", "price": "¥118.0 起", "kw": "安溪铁观音茶礼盒提亲"},
            {"icon": "🎁", "name": "武夷岩茶大红袍高档喜庆伴手礼", "desc": "正岩醇厚·红罐喜庆礼装·尊贵宾客回礼", "price": "¥88.0 起", "kw": "武夷岩茶大红袍婚庆礼盒"}
        ]
    },
    "shandong.html": {
        "title": "山东传统婚俗 · 胶东花饽饽与阿胶过礼甄选",
        "items": [
            {"icon": "🥟", "name": "胶东手工大花饽饽喜饼礼盒（龙凤呈祥）", "desc": "齐鲁非遗面塑·传统过礼大件·吉祥喜气十足", "price": "¥88.0 起", "kw": "胶东花饽饽婚礼礼盒"},
            {"icon": "🎁", "name": "正品东阿阿胶提亲过礼滋补礼盒", "desc": "传统厚重聘礼·长辈关怀心意·体面过礼之选", "price": "¥298.0 起", "kw": "东阿阿胶提亲过礼礼盒"}
        ]
    },
    "sichuan.html": {
        "title": "四川传统婚俗 · 川派喜酒与非遗蜀绣甄选",
        "items": [
            {"icon": "🍶", "name": "川派浓香型婚宴定制喜酒（纯粮红瓶对装）", "desc": "纯粮酿造·喜庆大红瓶·川渝婚宴必备上席酒", "price": "¥138.0 起", "kw": "四川浓香型婚宴喜酒"},
            {"icon": "🪡", "name": "传统非遗手工蜀绣伴手礼盒（双面绣摆件）", "desc": "蜀地非遗技艺·丝线温润·典雅婚礼答谢物料", "price": "¥78.0 起", "kw": "传统蜀绣婚礼伴手礼盒"}
        ]
    },
    "beijing.html": {
        "title": "北京传统婚俗 · 京味稻香村喜饼与景泰蓝甄选",
        "items": [
            {"icon": "🥮", "name": "北京稻香村百年好合喜饼礼盒", "desc": "传统京八件·京味提亲过礼·阖家美满吉祥喜饼", "price": "¥79.0 起", "kw": "稻香村喜饼礼盒"},
            {"icon": "🏺", "name": "非遗景泰蓝珐琅掐丝伴手礼摆件", "desc": "燕京八绝工艺·典雅端庄·长辈高档答谢礼", "price": "¥128.0 起", "kw": "景泰蓝婚礼伴手礼"}
        ]
    },
    "shanghai.html": {
        "title": "上海海派婚俗 · 龙凤喜饼与定制喜糖甄选",
        "items": [
            {"icon": "🥮", "name": "海派乔家栅传统龙凤喜饼礼盒", "desc": "老上海经典味道·酥皮香软·传统定亲好礼", "price": "¥88.0 起", "kw": "乔家栅喜饼礼盒"},
            {"icon": "🍬", "name": "海派大白兔奶糖高档定制婚庆礼盒", "desc": "国民经典甜蜜记忆·复古铁盒·宾客分享首选", "price": "¥35.0 起", "kw": "大白兔婚庆定制喜糖"}
        ]
    },
    "tianjin.html": {
        "title": "天津传统婚俗 · 十八街大麻花与杨柳青甄选",
        "items": [
            {"icon": "🥨", "name": "桂发祥十八街麻花传统喜庆大礼盒", "desc": "津门非遗老字号·酥脆香甜·传统过礼大件", "price": "¥68.0 起", "kw": "桂发祥十八街麻花礼盒"},
            {"icon": "🖼️", "name": "杨柳青年画连生贵子吉庆摆件", "desc": "津门传统非遗·喜气盈门·新房装饰首选", "price": "¥58.0 起", "kw": "杨柳青年画婚礼摆件"}
        ]
    },
    "chongqing.html": {
        "title": "重庆婚俗风情 · 纯粮喜酒与合川桃片甄选",
        "items": [
            {"icon": "🍶", "name": "重庆纯粮高粱红瓶婚宴定制喜酒", "desc": "窖香浓郁·红运当头·巴渝婚宴主桌用酒", "price": "¥108.0 起", "kw": "重庆婚宴喜酒定制"},
            {"icon": "🥟", "name": "传统合川桃片薄片喜饼礼盒", "desc": "香甜软糯·百年传统茶食·提亲过礼好物", "price": "¥45.0 起", "kw": "合川桃片礼盒"}
        ]
    },
    "jiangsu.html": {
        "title": "江苏水乡婚俗 · 洞庭碧螺春与苏绣礼盒甄选",
        "items": [
            {"icon": "🍵", "name": "苏州洞庭碧螺春特级提亲茶礼盒", "desc": "花果香馥郁·水乡茶道聘礼·清雅高贵之选", "price": "¥168.0 起", "kw": "苏州碧螺春茶礼盒提亲"},
            {"icon": "🪡", "name": "苏州非遗手工苏绣双面绣婚庆对装", "desc": "针脚细密·江南温婉美学·伴手礼上品", "price": "¥98.0 起", "kw": "苏绣双面绣婚礼礼盒"}
        ]
    },
    "anhui.html": {
        "title": "安徽传统婚俗 · 黄山毛峰与古井贡喜酒甄选",
        "items": [
            {"icon": "🍵", "name": "黄山毛峰核心产区提亲茶礼盒", "desc": "徽州三茶六礼·清香醇厚·提亲敬茶优选", "price": "¥138.0 起", "kw": "黄山毛峰茶礼盒提亲"},
            {"icon": "🍶", "name": "古井贡酒年份原浆婚宴喜酒（对装）", "desc": "江淮浓香名酒·大红喜庆包装·婚宴上席好酒", "price": "¥198.0 起", "kw": "古井贡酒婚宴喜酒"}
        ]
    },
    "hebei.html": {
        "title": "河北燕赵婚俗 · 衡水老白干与承德杏仁甄选",
        "items": [
            {"icon": "🍶", "name": "衡水老白干婚宴喜酒（红瓶对装）", "desc": "地缸发酵·地道老白干香型·燕赵过礼大件", "price": "¥128.0 起", "kw": "衡水老白干婚宴喜酒"},
            {"icon": "🌰", "name": "承德特产大杏仁养生过礼礼盒", "desc": "颗粒饱满·营养滋补·传统回礼健康之选", "price": "¥68.0 起", "kw": "承德大杏仁礼盒"}
        ]
    },
    "shanxi.html": {
        "title": "山西晋商婚俗 · 汾酒青花喜酒与平遥牛肉甄选",
        "items": [
            {"icon": "🍶", "name": "山西汾酒清香型婚宴喜酒（对装）", "desc": "清香纯正·晋商传统婚宴首选·大气质朴", "price": "¥188.0 起", "kw": "山西汾酒婚宴喜酒"},
            {"icon": "🥩", "name": "平遥冠云牛肉非遗传统过礼大礼盒", "desc": "三百年工艺·肉质鲜嫩·三晋过礼厚重硬货", "price": "¥99.0 起", "kw": "平遥牛肉礼盒"}
        ]
    },
    "henan.html": {
        "title": "河南中原婚俗 · 信阳毛尖与彩陶坊喜酒甄选",
        "items": [
            {"icon": "🍵", "name": "信阳毛尖核心产区提亲茶礼盒", "desc": "细圆光直·中原传统茶礼·提亲过礼标配", "price": "¥128.0 起", "kw": "信阳毛尖茶礼盒提亲"},
            {"icon": "🍶", "name": "仰韶彩陶坊地利婚宴喜酒（对装）", "desc": "陶香型名酒·古朴典雅红陶·中原婚宴上席", "price": "¥168.0 起", "kw": "仰韶彩陶坊婚宴喜酒"}
        ]
    },
    "hubei.html": {
        "title": "湖北荆楚婚俗 · 恩施玉露与白云边喜酒甄选",
        "items": [
            {"icon": "🍵", "name": "恩施玉露蒸青绿茶提亲茶礼盒", "desc": "非遗蒸青工艺·荆楚提亲茶礼·鲜爽甘醇", "price": "¥118.0 起", "kw": "恩施玉露茶礼盒提亲"},
            {"icon": "🍶", "name": "白云边兼香型婚宴喜酒（对装）", "desc": "浓酱兼香·口感甘爽·楚天大宴必备喜酒", "price": "¥148.0 起", "kw": "白云边婚宴喜酒"}
        ]
    },
    "hunan.html": {
        "title": "湖南湖湘婚俗 · 酒鬼酒红坛与君山银针甄选",
        "items": [
            {"icon": "🍶", "name": "酒鬼酒红坛馥郁香型婚宴喜酒", "desc": "三香九韵·大红麻袋包装·喜庆浓郁上席酒", "price": "¥218.0 起", "kw": "酒鬼酒红坛婚宴喜酒"},
            {"icon": "🍵", "name": "岳阳君山银针黄茶提亲高档礼盒", "desc": "金镶玉名茶·湖湘雅致聘礼·滋味甘醇", "price": "¥158.0 起", "kw": "君山银针茶礼盒"}
        ]
    },
    "jiangxi.html": {
        "title": "江西赣鄱婚俗 · 景德镇红瓷喜碗与皇菊甄选",
        "items": [
            {"icon": "🥣", "name": "景德镇纯手工红瓷龙凤喜碗对装", "desc": "中国红高温釉·添丁添喜·新人压箱传家瓷", "price": "¥88.0 起", "kw": "景德镇龙凤喜碗对装"},
            {"icon": "🌼", "name": "婺源皇菊特级朵大金丝茶礼盒", "desc": "一室生香·金黄富贵·婚礼敬茶养生佳品", "price": "¥68.0 起", "kw": "婺源皇菊礼盒"}
        ]
    },
    "shaanxi.html": {
        "title": "陕西关中婚俗 · 西凤酒喜酒与富平柿饼甄选",
        "items": [
            {"icon": "🍶", "name": "陕西西凤酒凤香型婚宴定制喜酒", "desc": "三千年凤香·醇香典雅·三秦大地大红喜酒", "price": "¥138.0 起", "kw": "西凤酒婚宴喜酒"},
            {"icon": "🥟", "name": "富平特级霜降柿饼事事如意礼盒", "desc": "吊柿如意·甜如蜜糖·象征事事如意好兆头", "price": "¥58.0 起", "kw": "富平柿饼礼盒"}
        ]
    },
    "guizhou.html": {
        "title": "贵州黔地婚俗 · 茅台镇酱香喜酒与苗绣甄选",
        "items": [
            {"icon": "🍶", "name": "贵州茅台镇大曲酱香婚宴定制喜酒", "desc": "纯粮坤沙·酱香浓郁·体面大气的婚宴用酒", "price": "¥168.0 起", "kw": "茅台镇婚宴酱香喜酒"},
            {"icon": "🪡", "name": "非遗手工苗族刺绣香囊伴手礼盒", "desc": "苗家飞针走线·吉祥纹样·深情答谢伴手礼", "price": "¥48.0 起", "kw": "苗绣婚礼伴手礼"}
        ]
    },
    "yunnan.html": {
        "title": "云南彩云婚俗 · 传统鲜花饼与普洱对茶甄选",
        "items": [
            {"icon": "🌸", "name": "云南玫瑰鲜花饼高档伴手礼盒", "desc": "重瓣红玫瑰·花香四溢·婚礼分享浪漫美味", "price": "¥49.9 起", "kw": "云南鲜花饼伴手礼盒"},
            {"icon": "🍵", "name": "云南普洱生熟紧压龙凤饼茶对装", "desc": "岁月陈香·成双成对·长久相伴传世茶礼", "price": "¥128.0 起", "kw": "普洱茶龙凤饼茶礼"}
        ]
    },
    "guangxi.html": {
        "title": "广西八桂婚俗 · 壮锦绣球与桂林罗汉果甄选",
        "items": [
            {"icon": "🧶", "name": "传统手工壮锦同心绣球挂件礼盒", "desc": "壮乡定情信物·十二瓣同心结·吉祥幸福", "price": "¥38.0 起", "kw": "壮锦绣球婚礼挂件"},
            {"icon": "🫖", "name": "桂林永福罗汉果黄金果礼盒", "desc": "天然清润·圆满如意·健康伴手礼好物", "price": "¥55.0 起", "kw": "桂林罗汉果礼盒"}
        ]
    },
    "hainan.html": {
        "title": "海南海岛婚俗 · 黎锦工艺与春光喜糖甄选",
        "items": [
            {"icon": "🧵", "name": "海南非遗黎锦手工织造伴手礼", "desc": "千年黎锦技艺·图腾寓意深远·独特海岛心意", "price": "¥78.0 起", "kw": "海南黎锦婚礼伴手礼"},
            {"icon": "🥥", "name": "春光纯正特浓椰子喜糖大礼包", "desc": "海岛浓醇椰香·甜蜜滋味·宾客老少皆宜", "price": "¥36.0 起", "kw": "海南椰子喜糖大礼包"}
        ]
    },
    "inner-mongolia.html": {
        "title": "内蒙古草原婚俗 · 纯银对碗与传统奶食甄选",
        "items": [
            {"icon": "🥣", "name": "蒙古族传统纯银镶木对碗礼盒", "desc": "草原尊贵聘礼·成双成对·白首偕老吉庆器", "price": "¥228.0 起", "kw": "蒙古族纯银对碗婚礼"},
            {"icon": "🧀", "name": "草原传统奶皮子奶酪喜庆大礼包", "desc": "纯正奶香·洁白纯净·草原婚礼传统敬客礼", "price": "¥68.0 起", "kw": "内蒙古奶食品礼盒"}
        ]
    },
    "gansu.html": {
        "title": "甘肃陇上婚俗 · 兰州百合干与陇南茶礼甄选",
        "items": [
            {"icon": "🌾", "name": "兰州特级甜百合干百年好合礼盒", "desc": "百年好合寓意·甘甜滋补·陇上传统过礼必备", "price": "¥78.0 起", "kw": "兰州百合干礼盒"},
            {"icon": "🍵", "name": "陇南龙神翠竹特级绿茶提亲茶礼", "desc": "高山云雾·清香持久·西北雅致提亲茶", "price": "¥108.0 起", "kw": "陇南绿茶茶礼"}
        ]
    },
    "qinghai.html": {
        "title": "青海高原婚俗 · 青稞喜酒与黑枸杞滋补甄选",
        "items": [
            {"icon": "🍶", "name": "互助青稞酒红瓶婚宴定制喜酒", "desc": "高原纯净青稞·清亮纯甜·西北豪迈喜酒", "price": "¥99.0 起", "kw": "互助青稞酒婚宴喜酒"},
            {"icon": "🍇", "name": "柴达木野生黑枸杞养生过礼礼盒", "desc": "高原花青素·滋补大礼·体面过礼之选", "price": "¥118.0 起", "kw": "青海黑枸杞礼盒"}
        ]
    },
    "ningxia.html": {
        "title": "宁夏塞上婚俗 · 中宁红枸杞与贺兰红酒甄选",
        "items": [
            {"icon": "🍒", "name": "中宁正宗特级红枸杞红红火火礼盒", "desc": "道地中宁红宝·红火甜蜜·传统过礼养生好物", "price": "¥68.0 起", "kw": "中宁枸杞礼盒"},
            {"icon": "🍷", "name": "贺兰山东麓产区干红葡萄酒对装", "desc": "国家地理标志·浓郁醇厚·现代婚宴高端定制", "price": "¥158.0 起", "kw": "贺兰山东麓红酒婚宴"}
        ]
    },
    "xinjiang.html": {
        "title": "新疆西域婚俗 · 和田大枣与羊脂玉对佩甄选",
        "items": [
            {"icon": "🍎", "name": "和田特级红枣早生贵子大礼盒", "desc": "皮薄肉厚核小·早生贵子好彩头·过礼必备", "price": "¥58.0 起", "kw": "和田大枣婚礼礼盒"},
            {"icon": "💎", "name": "和田玉白玉平安扣龙凤对佩吊坠", "desc": "温润如玉·白头到老·传统婚定压箱信物", "price": "¥268.0 起", "kw": "和田玉龙凤对佩婚礼"}
        ]
    },
    "tibet.html": {
        "title": "西藏雪域婚俗 · 吉祥八宝哈达与藏红花甄选",
        "items": [
            {"icon": "🧣", "name": "藏式高档吉祥八宝刺绣红哈达对装", "desc": "最高敬意与祝福·纯洁神圣·雪域婚礼必备", "price": "¥48.0 起", "kw": "西藏吉祥八宝哈达"},
            {"icon": "🌸", "name": "特级正宗藏红花养生过礼礼盒", "desc": "名贵药材·长辈心意·珍贵聘礼过礼大件", "price": "¥238.0 起", "kw": "西藏藏红花礼盒"}
        ]
    },
    "liaoning.html": {
        "title": "辽宁关东婚俗 · 盘锦五谷喜粮与伴手礼甄选",
        "items": [
            {"icon": "🌾", "name": "盘锦特级有机喜粮五谷丰登礼盒", "desc": "五谷丰登寓意·粒粒饱满·东北婚俗压箱粮", "price": "¥58.0 起", "kw": "盘锦大米喜粮礼盒"},
            {"icon": "🍬", "name": "不老林传统经典喜糖大礼包", "desc": "东北传统喜糖·香浓酥脆·经典婚宴分享糖", "price": "¥35.0 起", "kw": "不老林喜糖大礼包"}
        ]
    },
    "jilin.html": {
        "title": "吉林白山松水 · 长白山红参与朝鲜族打糕甄选",
        "items": [
            {"icon": "🪵", "name": "长白山特级红参滋补过礼礼盒", "desc": "参情厚意·名贵中草药·长辈尊崇过大礼", "price": "¥198.0 起", "kw": "长白山红参礼盒"},
            {"icon": "🍡", "name": "延边朝鲜族传统手工打糕喜饼", "desc": "软糯劲道·甜美如初·吉庆特色分享美食", "price": "¥38.0 起", "kw": "延边打糕礼盒"}
        ]
    },
    "heilongjiang.html": {
        "title": "黑龙江冰城婚俗 · 北大荒五谷与秋林红肠甄选",
        "items": [
            {"icon": "🌾", "name": "北大荒五谷杂粮早生贵子喜箱礼盒", "desc": "黑土地精华·家肥屋润·传统大件定亲粮", "price": "¥68.0 起", "kw": "北大荒五谷杂粮礼盒"},
            {"icon": "🥓", "name": "秋林里道斯传统果木红肠伴手礼", "desc": "百年俄式非遗·蒜香浓郁·特色宴客佳品", "price": "¥78.0 起", "kw": "秋林里道斯红肠礼盒"}
        ]
    },
    "hong-kong.html": {
        "title": "香港港式婚俗 · 传统嫁女绫酥与工夫茶甄选",
        "items": [
            {"icon": "🥮", "name": "奇华饼家传统嫁女喜饼绫酥礼盒", "desc": "港式传统制饼·红绫黄绫白绫·过大礼标配", "price": "¥128.0 起", "kw": "奇华嫁女饼礼盒"},
            {"icon": "🍵", "name": "港式精选陈年普洱工夫茶礼盒", "desc": "浓醇顺滑·敬茶大礼·高雅体面之选", "price": "¥148.0 起", "kw": "香港茶礼盒提亲"}
        ]
    },
    "macao.html": {
        "title": "澳门濠江婚俗 · 传统手作杏仁饼与伴手礼甄选",
        "items": [
            {"icon": "🥮", "name": "澳门传统炭烧手工杏仁饼礼盒", "desc": "百年非遗炭烧·香浓酥脆·濠江过礼分享佳品", "price": "¥58.0 起", "kw": "澳门杏仁饼礼盒"},
            {"icon": "🎁", "name": "葡式经典特色风味伴手礼盒", "desc": "中西合璧风情·精致典雅·婚礼回礼优选", "price": "¥68.0 起", "kw": "澳门特色伴手礼盒"}
        ]
    },
    "taiwan.html": {
        "title": "台湾宝岛婚俗 · 传统汉饼大饼与冻顶乌龙甄选",
        "items": [
            {"icon": "🥮", "name": "台湾传统龙凤大饼芝麻蛋黄汉饼礼盒", "desc": "文定六礼大饼·皮薄馅足·圆满喜庆好彩头", "price": "¥88.0 起", "kw": "台湾汉饼喜饼大礼盒"},
            {"icon": "🍵", "name": "台湾原产冻顶乌龙提亲对装茶礼", "desc": "焙火醇香·喉韵悠长·宝岛文定传统茶礼", "price": "¥158.0 起", "kw": "台湾冻顶乌龙茶礼盒"}
        ]
    }
}

def generate_box_html(data):
    items_html = ""
    for item in data["items"]:
        url = f"https://search.jd.com/Search?keyword={item['kw']}&enc=utf-8&unionId=2038503768"
        items_html += f"""
      <a href="{url}" target="_blank" rel="nofollow sponsored" style="display:block;background:#0e0a14;border:1px solid var(--line);border-radius:10px;padding:16px;text-decoration:none;color:var(--ink);transition:border-color .2s;">
        <div style="font-size:26px;margin-bottom:8px;">{item['icon']}</div>
        <div style="font-weight:700;font-size:15px;color:var(--ink);margin-bottom:5px;">{item['name']}</div>
        <div style="font-size:13px;color:var(--sub);margin-bottom:10px;line-height:1.5;">{item['desc']}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#ff6b9d;font-weight:700;font-size:14px;">{item['price']}</span>
          <span style="font-size:12px;background:linear-gradient(90deg,#ff6b9d,#ffd28a);color:#1a0f1f;padding:3px 10px;border-radius:999px;font-weight:700;">去京东查看 &gt;</span>
        </div>
      </a>"""

    return f"""
<!-- 地方婚俗好物推荐模块 (京东联盟) -->
<section class="local-customs-goods" style="margin:36px 0 24px;padding:22px;background:var(--panel);border:1px solid rgba(212,165,116,.25);border-radius:12px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div style="font-size:16px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;">
      <span>🍵</span> {data['title']}
    </div>
    <span style="font-size:12px;color:var(--sub);">地方风物 · 京东直发</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:14px;">{items_html}
  </div>
</section>
"""

def inject():
    blog_dir = os.path.join(PROJECT_ROOT, "blog")
    success = 0
    for filename, data in PROVINCE_GOODS.items():
        filepath = os.path.join(blog_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Clean out any old block
            content = re.sub(r'<!-- 地方婚俗好物推荐模块 \(京东联盟\) -->.*?</section>', '', content, flags=re.DOTALL)
            
            box_html = generate_box_html(data)
            
            inserted = False
            for target in ["<h2>继续准备</h2>", "<h2>相关指南</h2>", "</article>"]:
                if target in content:
                    content = content.replace(target, box_html + "\n" + target)
                    inserted = True
                    break
            
            if inserted:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                success += 1
                print(f"Successfully injected local goods into: {filename}")
            else:
                print(f"No target found in: {filename}")
        else:
            print(f"File not found: {filename}")

    print(f"\nTotal provinces injected: {success} / {len(PROVINCE_GOODS)}")

if __name__ == '__main__':
    inject()
