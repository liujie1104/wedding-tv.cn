import os
import re

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"

PROVINCE_GOODS = {
    "guangdong.html": {
        "title": "广东传统婚俗 · 提亲茶礼与嫁女喜饼甄选",
        "items": [
            {
                "icon": "🥮",
                "name": "广式传统嫁女喜饼大礼盒（绫酥对装）",
                "desc": "非遗传承·广府提亲礼饼·红绫黄绫传统喜意",
                "price": "¥68.0 起",
                "kw": "广式传统嫁女喜饼大礼盒"
            },
            {
                "icon": "🍵",
                "name": "潮汕凤凰单丛提亲工夫茶礼盒",
                "desc": "高山蜜兰香·潮汕敬茶三礼·传统工夫茶对装",
                "price": "¥128.0 起",
                "kw": "潮汕工夫茶礼盒提亲"
            }
        ]
    },
    "zhejiang.html": {
        "title": "浙江传统婚俗 · 西湖茶礼与绍兴喜酒甄选",
        "items": [
            {
                "icon": "🍵",
                "name": "杭州西湖龙井高档提亲茶礼盒",
                "desc": "明前特级·江南以茶为媒·端庄大气提亲礼",
                "price": "¥158.0 起",
                "kw": "西湖龙井茶礼盒提亲"
            },
            {
                "icon": "🍶",
                "name": "绍兴花雕封坛手工黄酒（婚宴定制对坛）",
                "desc": "女儿红传统·手工冬酿·婚宴上席与回门好礼",
                "price": "¥99.0 起",
                "kw": "绍兴花雕婚宴封坛黄酒"
            }
        ]
    },
    "fujian.html": {
        "title": "福建传统婚俗 · 闽南敬茶与大红袍伴手礼甄选",
        "items": [
            {
                "icon": "🍵",
                "name": "安溪铁观音提亲茶礼盒（传统对装）",
                "desc": "兰花香正味·闽南提亲过礼·新人敬茶标配",
                "price": "¥118.0 起",
                "kw": "安溪铁观音茶礼盒提亲"
            },
            {
                "icon": "🎁",
                "name": "武夷岩茶大红袍高档喜庆伴手礼",
                "desc": "正岩醇厚·红罐喜庆礼装·尊贵宾客回礼",
                "price": "¥88.0 起",
                "kw": "武夷岩茶大红袍婚庆礼盒"
            }
        ]
    },
    "shandong.html": {
        "title": "山东传统婚俗 · 胶东花饽饽与阿胶过礼甄选",
        "items": [
            {
                "icon": "🥟",
                "name": "胶东手工大花饽饽喜饼礼盒（龙凤呈祥）",
                "desc": "齐鲁非遗面塑·传统过礼大件·吉祥喜气十足",
                "price": "¥88.0 起",
                "kw": "胶东花饽饽婚礼礼盒"
            },
            {
                "icon": "🎁",
                "name": "正品东阿阿胶提亲过礼滋补礼盒",
                "desc": "传统厚重聘礼·长辈关怀心意·体面过礼之选",
                "price": "¥298.0 起",
                "kw": "东阿阿胶提亲过礼礼盒"
            }
        ]
    },
    "sichuan.html": {
        "title": "四川传统婚俗 · 川派喜酒与非遗蜀绣甄选",
        "items": [
            {
                "icon": "🍶",
                "name": "川派浓香型婚宴定制喜酒（纯粮红瓶对装）",
                "desc": "纯粮酿造·喜庆大红瓶·川渝婚宴必备上席酒",
                "price": "¥138.0 起",
                "kw": "四川浓香型婚宴喜酒"
            },
            {
                "icon": "🪡",
                "name": "传统非遗手工蜀绣伴手礼盒（双面绣摆件）",
                "desc": "蜀地非遗技艺·丝线温润·典雅婚礼答谢物料",
                "price": "¥78.0 起",
                "kw": "传统蜀绣婚礼伴手礼盒"
            }
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
                print(f"Successfully injected local goods into: {filename}")
            else:
                print(f"No target found in: {filename}")

if __name__ == '__main__':
    inject()
