import os
import re

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"
UNION_ID = "2038503768"

GOODS_VOWS = """
  <!-- 备婚好物推荐模块 (京东联盟) -->
  <div class="card" style="border: 1px solid rgba(255,210,138,.25); background: linear-gradient(180deg, #171121 0%, #1c1429 100%);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:16px;font-weight:700;color:var(--gold);display:flex;align-items:center;gap:6px;">
        <span>🛍️</span> 备婚精选 · 誓词与仪式好物
      </div>
      <span style="font-size:12px;color:var(--sub);">京东正品 · 极速达</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;">
      <a href="https://search.jd.com/Search?keyword=婚礼誓词本&enc=utf-8&unionId=2038503768" target="_blank" rel="nofollow sponsored" style="display:block;background:#0e0a14;border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:var(--ink);transition:border-color .2s;">
        <div style="font-size:24px;margin-bottom:8px;">📖</div>
        <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:4px;">烫金丝绒手写誓词本（对装）</div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:8px;">高克重特种纸·防透墨·现场拍照超上镜</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--rose);font-weight:700;font-size:14px;">¥19.9 起</span>
          <span style="font-size:12px;background:linear-gradient(90deg,#ff6b9d,#ffd28a);color:#1a0f1f;padding:2px 8px;border-radius:999px;font-weight:700;">去京东查看 &gt;</span>
        </div>
      </a>
      <a href="https://search.jd.com/Search?keyword=婚礼戒指盒&enc=utf-8&unionId=2038503768" target="_blank" rel="nofollow sponsored" style="display:block;background:#0e0a14;border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:var(--ink);transition:border-color .2s;">
        <div style="font-size:24px;margin-bottom:8px;">💍</div>
        <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:4px;">高档双戒丝绒仪式盒</div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:8px;">法式八角复古风·特写镜头必备物料</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--rose);font-weight:700;font-size:14px;">¥28.0 起</span>
          <span style="font-size:12px;background:linear-gradient(90deg,#ff6b9d,#ffd28a);color:#1a0f1f;padding:2px 8px;border-radius:999px;font-weight:700;">去京东查看 &gt;</span>
        </div>
      </a>
    </div>
  </div>
"""

GOODS_CHECKLIST = """
  <!-- 备婚好物推荐模块 (京东联盟) -->
  <div class="card" style="border: 1px solid rgba(255,210,138,.25); background: linear-gradient(180deg, #171121 0%, #1c1429 100%);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:16px;font-weight:700;color:var(--gold);display:flex;align-items:center;gap:6px;">
        <span>🛍️</span> 备婚刚需 · 筹备清单急救与接亲好物
      </div>
      <span style="font-size:12px;color:var(--sub);">京东正品 · 极速达</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;">
      <a href="https://search.jd.com/Search?keyword=新娘婚礼应急包&enc=utf-8&unionId=2038503768" target="_blank" rel="nofollow sponsored" style="display:block;background:#0e0a14;border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:var(--ink);transition:border-color .2s;">
        <div style="font-size:24px;margin-bottom:8px;">🧰</div>
        <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:4px;">新娘婚礼应急包（38件套）</div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:8px;">别针/去渍笔/防磨贴/针线/吸管全套</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--rose);font-weight:700;font-size:14px;">¥39.9 起</span>
          <span style="font-size:12px;background:linear-gradient(90deg,#ff6b9d,#ffd28a);color:#1a0f1f;padding:2px 8px;border-radius:999px;font-weight:700;">去京东查看 &gt;</span>
        </div>
      </a>
      <a href="https://search.jd.com/Search?keyword=接亲堵门道具&enc=utf-8&unionId=2038503768" target="_blank" rel="nofollow sponsored" style="display:block;background:#0e0a14;border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:var(--ink);transition:border-color .2s;">
        <div style="font-size:24px;margin-bottom:8px;">🎉</div>
        <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:4px;">接亲堵门游戏整蛊道具礼盒</div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:8px;">指压板/扩口器/面部保鲜膜/誓言卡</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--rose);font-weight:700;font-size:14px;">¥29.9 起</span>
          <span style="font-size:12px;background:linear-gradient(90deg,#ff6b9d,#ffd28a);color:#1a0f1f;padding:2px 8px;border-radius:999px;font-weight:700;">去京东查看 &gt;</span>
        </div>
      </a>
    </div>
  </div>
"""

GOODS_QR = """
  <!-- 备婚好物推荐模块 (京东联盟) -->
  <div class="card" style="border: 1px solid rgba(255,210,138,.25); background: linear-gradient(180deg, #171121 0%, #1c1429 100%);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:16px;font-weight:700;color:var(--gold);display:flex;align-items:center;gap:6px;">
        <span>🛍️</span> 现场布置 · 签到台与水牌物料精选
      </div>
      <span style="font-size:12px;color:var(--sub);">京东正品 · 极速达</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;">
      <a href="https://search.jd.com/Search?keyword=婚礼迎宾水牌&enc=utf-8&unionId=2038503768" target="_blank" rel="nofollow sponsored" style="display:block;background:#0e0a14;border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:var(--ink);transition:border-color .2s;">
        <div style="font-size:24px;margin-bottom:8px;">🖼️</div>
        <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:4px;">亚克力迎宾二维码水牌</div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:8px;">高清透亮·金属支架·签到台合影焦点</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--rose);font-weight:700;font-size:14px;">¥35.0 起</span>
          <span style="font-size:12px;background:linear-gradient(90deg,#ff6b9d,#ffd28a);color:#1a0f1f;padding:2px 8px;border-radius:999px;font-weight:700;">去京东查看 &gt;</span>
        </div>
      </a>
      <a href="https://search.jd.com/Search?keyword=婚礼喜糖盒伴手礼&enc=utf-8&unionId=2038503768" target="_blank" rel="nofollow sponsored" style="display:block;background:#0e0a14;border:1px solid var(--line);border-radius:10px;padding:14px;text-decoration:none;color:var(--ink);transition:border-color .2s;">
        <div style="font-size:24px;margin-bottom:8px;">🎁</div>
        <div style="font-weight:700;font-size:14px;color:var(--ink);margin-bottom:4px;">高级定制喜糖/伴手礼盒</div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:8px;">丝带礼盒·质感烫金·宾客赞不绝口</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--rose);font-weight:700;font-size:14px;">¥12.8 起</span>
          <span style="font-size:12px;background:linear-gradient(90deg,#ff6b9d,#ffd28a);color:#1a0f1f;padding:2px 8px;border-radius:999px;font-weight:700;">去京东查看 &gt;</span>
        </div>
      </a>
    </div>
  </div>
"""

def clean_and_update():
    # 1. vows.html
    vows_path = os.path.join(PROJECT_ROOT, "vows.html")
    if os.path.exists(vows_path):
        with open(vows_path, 'r', encoding='utf-8') as f:
            c = f.read()
        # Remove old block if exists
        c = re.sub(r'\s*<!-- 备婚好物推荐模块 \(京东联盟\) -->.*?</div>\s*</div>\s*</div>', '', c, flags=re.DOTALL)
        c = c.replace('<div class="related">', GOODS_VOWS + '\n  <div class="related">')
        with open(vows_path, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Cleaned and updated vows.html")

    # 2. checklist.html
    checklist_path = os.path.join(PROJECT_ROOT, "checklist.html")
    if os.path.exists(checklist_path):
        with open(checklist_path, 'r', encoding='utf-8') as f:
            c = f.read()
        # Remove old block if exists
        c = re.sub(r'\s*<!-- 备婚好物推荐模块 \(京东联盟\) -->.*?</div>\s*</div>\s*</div>', '', c, flags=re.DOTALL)
        # Place INSIDE wrap right above related
        c = c.replace('<div class="related">', GOODS_CHECKLIST + '\n  <div class="related">')
        with open(checklist_path, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Cleaned and updated checklist.html")

    # 3. qr-poster.html
    qr_path = os.path.join(PROJECT_ROOT, "qr-poster.html")
    if os.path.exists(qr_path):
        with open(qr_path, 'r', encoding='utf-8') as f:
            c = f.read()
        # Remove old block if exists
        c = re.sub(r'\s*<!-- 备婚好物推荐模块 \(京东联盟\) -->.*?</div>\s*</div>\s*</div>', '', c, flags=re.DOTALL)
        # Place INSIDE wrap right above content-boundary
        c = c.replace('<section class="content-boundary"', GOODS_QR + '\n<section class="content-boundary"')
        with open(qr_path, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Cleaned and updated qr-poster.html")

if __name__ == '__main__':
    clean_and_update()
