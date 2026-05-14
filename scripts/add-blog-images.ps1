# 给 blog/*.html 注入 SVG hero 横幅 + 内文插画（自包含、永不失效）
# 用法：powershell -File scripts/add-blog-images.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "blog"

# 区域配色 + emoji
$AREA_MAP = @{
  "华北" = @{c1="#ff6b9d"; c2="#ffd28a"; emoji="💒"; tag="北方红"}
  "华东" = @{c1="#6b9fff"; c2="#a3d4ff"; emoji="💐"; tag="海派蓝"}
  "华南" = @{c1="#88d8b0"; c2="#d4a574"; emoji="🌺"; tag="南国金"}
  "华中" = @{c1="#ff8e53"; c2="#ffd28a"; emoji="🎊"; tag="中原橙"}
  "西南" = @{c1="#b388ff"; c2="#ff8ed4"; emoji="🏔️"; tag="山岚紫"}
  "西北" = @{c1="#d4a574"; c2="#c8a06b"; emoji="🐪"; tag="大漠土"}
  "东北" = @{c1="#88c5ff"; c2="#a3e0ff"; emoji="❄️"; tag="冰雪蓝"}
}

# 4 张通用文中插画（自包含 SVG）
$ILL_TIQIN = @'
<figure class="ill-card"><svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1320"/><stop offset="1" stop-color="#2a1830"/></linearGradient></defs><rect width="600" height="220" rx="12" fill="url(#g1)"/><text x="300" y="110" text-anchor="middle" font-size="64">🫖🎁</text><text x="300" y="170" text-anchor="middle" fill="#d4a574" font-size="18" font-family="serif">提亲订婚 · 媒人登门 · 三茶六礼</text><text x="300" y="195" text-anchor="middle" fill="#b9b1a3" font-size="12">从陌生到一家人的开始</text></svg><figcaption>提亲与订婚 · 双方家庭礼尚往来</figcaption></figure>
'@

$ILL_CAILI = @'
<figure class="ill-card"><svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1320"/><stop offset="1" stop-color="#301820"/></linearGradient></defs><rect width="600" height="220" rx="12" fill="url(#g2)"/><text x="300" y="110" text-anchor="middle" font-size="64">💍🎁🍷</text><text x="300" y="170" text-anchor="middle" fill="#d4a574" font-size="18" font-family="serif">过礼彩礼 · 三金五金 · 龙凤喜饼</text><text x="300" y="195" text-anchor="middle" fill="#b9b1a3" font-size="12">体面与诚意的较量</text></svg><figcaption>过礼与彩礼 · 双方诚意见证</figcaption></figure>
'@

$ILL_YINGQIN = @'
<figure class="ill-card"><svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1320"/><stop offset="1" stop-color="#301228"/></linearGradient></defs><rect width="600" height="220" rx="12" fill="url(#g3)"/><text x="300" y="110" text-anchor="middle" font-size="64">🚗💐👰</text><text x="300" y="170" text-anchor="middle" fill="#d4a574" font-size="18" font-family="serif">迎亲日 · 堵门红包 · 跨火盆</text><text x="300" y="195" text-anchor="middle" fill="#b9b1a3" font-size="12">单去双回 · 添丁进口</text></svg><figcaption>迎亲日 · 婚礼当天的关键时刻</figcaption></figure>
'@

$ILL_JINGJIU = @'
<figure class="ill-card"><svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1320"/><stop offset="1" stop-color="#28182a"/></linearGradient></defs><rect width="600" height="220" rx="12" fill="url(#g4)"/><text x="300" y="110" text-anchor="middle" font-size="64">🥂🎂💕</text><text x="300" y="170" text-anchor="middle" fill="#d4a574" font-size="18" font-family="serif">典礼喜宴 · 拜天地 · 交杯酒</text><text x="300" y="195" text-anchor="middle" fill="#b9b1a3" font-size="12">见证幸福的时刻</text></svg><figcaption>典礼与喜宴 · 亲友共贺新人</figcaption></figure>
'@

# 追加到 <style> 末尾的 CSS
$EXTRA_CSS = @'
.hero-banner{margin:18px 0 22px;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.4)}
.hero-banner svg{display:block;width:100%;height:auto}
.ill-card{margin:22px 0;padding:0;text-align:center}
.ill-card svg{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line)}
.ill-card figcaption{margin-top:8px;color:var(--mute);font-size:13px;font-style:italic}
'@

function Build-Hero($area, $name) {
  $cfg = $AREA_MAP[$area]
  if (-not $cfg) { $cfg = $AREA_MAP["华北"] }
  $c1 = $cfg.c1; $c2 = $cfg.c2; $emoji = $cfg.emoji; $tag = $cfg.tag
  return @"
<div class="hero-banner"><svg viewBox="0 0 800 280" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="$c1"/><stop offset="1" stop-color="$c2"/></linearGradient><pattern id="hp" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,.18)"/></pattern></defs><rect width="800" height="280" fill="url(#hg)"/><rect width="800" height="280" fill="url(#hp)"/><text x="120" y="160" font-size="120" opacity="0.95">$emoji</text><text x="280" y="130" fill="#fff" font-size="38" font-family="serif" font-weight="700">${name}婚俗</text><text x="280" y="170" fill="rgba(255,255,255,.85)" font-size="18" font-family="serif">从提亲到回门 · 老${name}人的结婚流程与禁忌</text><text x="280" y="210" fill="rgba(255,255,255,.7)" font-size="14">📍 ${area} · $tag · wedding-tv.cn</text><text x="280" y="240" fill="rgba(255,255,255,.55)" font-size="12">本文为图文整理，配图为示意 SVG，可随时替换为本地实拍照片</text></svg></div>
"@
}

$files = Get-ChildItem -Path $dir -Filter "*.html" | Where-Object { $_.Name -ne "_index_snippet.html" }
$count = 0
foreach ($f in $files) {
  $html = Get-Content -Path $f.FullName -Raw -Encoding UTF8

  # 跳过已经注入过的（同时支持"清理旧版重新注入"）
  if ($html -match 'class="hero-banner"') {
    # 去除已有 hero / 插画 / 之前追加的 CSS 块
    $html = $html -replace '(?s)<div class="hero-banner">.*?</div>\r?\n?', ''
    $html = $html -replace '(?s)<figure class="ill-card">.*?</figure>\r?\n?', ''
    $html = $html -replace '(?s)\.hero-banner\{margin:18px 0 22px.*?\.ill-card figcaption\{[^}]*italic\}\r?\n?', ''
  }

  # 提取地区(area)：优先从 meta 行 `📍 地区：华北` 读取
  $area = "华北"
  if ($html -match '📍\s*地区[：:]\s*([^<\s]+)') {
    $area = $Matches[1]
  }
  # 提取省份名：从 <h1> 中"XX婚俗大全"
  $name = ($f.BaseName)
  if ($html -match '<h1>([^婚<]+)婚俗大全') {
    $name = $Matches[1]
  }

  # 1) 在 </style> 前追加 CSS
  $html = $html -replace '</style>', "$EXTRA_CSS`n</style>"

  # 2) 在 .meta 块结束后(</div>紧跟 <p class="intro">)前面插入 hero
  $hero = Build-Hero -area $area -name $name
  $html = $html -replace '(<p class="intro">)', "$hero`n`$1"

  # 3) 各 H2 后插入对应插画
  $html = $html -replace '(<h2>二、[^<]*</h2>)', "`$1`n$ILL_TIQIN"
  $html = $html -replace '(<h2>三、[^<]*</h2>)', "`$1`n$ILL_CAILI"
  $html = $html -replace '(<h2>四、[^<]*</h2>)', "`$1`n$ILL_YINGQIN"
  $html = $html -replace '(<h2>五、[^<]*</h2>)', "`$1`n$ILL_JINGJIU"

  # 写回（UTF-8 无 BOM）
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($f.FullName, $html, $utf8NoBom)
  Write-Host "✅ $($f.Name)  area=$area  name=$name"
  $count++
}

Write-Host "`n🎨 已为 $count 篇文章注入 hero + 4 张插画（自包含 SVG）"
