# 给 9 个工具页统一升级 SoftwareApplication / WebApplication JSON-LD
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$today = '2026-05-18'

# 5 个已有 schema 的页面：替换为带 dateModified/description/publisher 的版本
$existing = @(
  @{ file='vows.html';     name='AI 婚礼誓词生成器'; desc='AI 智能生成中英文婚礼誓词，支持新郎/新娘/双方风格，纯前端无需注册。' }
  @{ file='speech.html';   name='AI 婚礼致辞生成器'; desc='AI 一键生成新人致辞、父母致辞、伴郎伴娘致辞，多风格可选。' }
  @{ file='countdown.html';name='婚礼倒计时海报生成器'; desc='输入婚期一键生成倒计时分享海报，自带浪漫模板。' }
  @{ file='almanac.html';  name='婚期吉日查询'; desc='结合传统黄历宜忌为你查询 2026/2027 年最佳结婚吉日。' }
  @{ file='mv-style.html'; name='婚礼MV风格匹配器'; desc='6 道选择题为你匹配最合适的婚礼MV风格。' }
)

# 4 个缺失 schema 的页面：新增
$toAdd = @(
  @{ file='qr-poster.html'; emoji='🔗'; name='婚礼请帖二维码海报生成器'; desc='把电子请帖链接转为精美二维码海报，朋友圈一键分享。' }
  @{ file='playlist.html';  emoji='🎵'; name='婚礼歌单推荐'; desc='精选 100+ 婚礼背景音乐，按场景（迎宾/敬酒/送客）分类。' }
  @{ file='budget-reference.html'; emoji='🏙️'; name='城市婚礼预算参考库'; desc='覆盖 50+ 城市婚礼平均预算数据：彩礼、酒席、婚纱、婚车、婚庆。' }
  @{ file='timeline-templates.html'; emoji='🗂️'; name='婚礼流程模板下载中心'; desc='中式/西式/草坪/酒店等多种婚礼流程模板，免费下载。' }
)

function Build-Schema($name, $url, $desc) {
  $obj = [ordered]@{
    '@context' = 'https://schema.org'
    '@type' = 'WebApplication'
    name = $name
    url = $url
    applicationCategory = 'LifestyleApplication'
    operatingSystem = 'Web'
    inLanguage = 'zh-CN'
    description = $desc
    dateModified = $today
    publisher = @{ '@type'='Organization'; name='wedding-tv.cn'; url='https://wedding-tv.cn/' }
    offers = @{ '@type'='Offer'; price='0'; priceCurrency='CNY' }
  }
  return ($obj | ConvertTo-Json -Depth 6 -Compress)
}

$count = 0
# ----- 处理已有 schema 的 5 个 -----
foreach ($p in $existing) {
  $abs = (Resolve-Path $p.file).Path
  $html = [System.IO.File]::ReadAllText($abs)
  if ($html -match 'dateModified') { Write-Host "− $($p.file) (已有 dateModified，跳过)"; continue }
  $url = "https://wedding-tv.cn/$($p.file)"
  $newJson = Build-Schema $p.name $url $p.desc
  # 替换第一段 WebApplication schema 内容
  $pattern = '<script type="application/ld\+json">\s*\{"@context":"https://schema\.org","@type":"WebApplication"[^<]*?</script>'
  if ($html -match $pattern) {
    $newBlock = "<script type=`"application/ld+json`">`n$newJson`n</script>"
    $html = [regex]::Replace($html, $pattern, [System.Text.RegularExpressions.Regex]::Escape($newBlock).Replace('\$','$$$$'), 'Singleline')
    # 上面 escape 太繁琐，改成直接 replace
  }
  # 简化：直接找一段固定结尾再替换
  $html = [System.IO.File]::ReadAllText($abs)
  $newBlock = "<script type=`"application/ld+json`">`n$newJson`n</script>"
  $regex = New-Object System.Text.RegularExpressions.Regex('<script type="application/ld\+json">\s*\{"@context":"https://schema\.org","@type":"WebApplication"[\s\S]*?</script>', 'Singleline')
  $newHtml = $regex.Replace($html, $newBlock, 1)
  # mv-style 是多行格式
  if ($newHtml -eq $html) {
    $regex2 = New-Object System.Text.RegularExpressions.Regex('<script type="application/ld\+json">\s*\{\s*"@context":\s*"https://schema\.org",\s*"@type":\s*"WebApplication"[\s\S]*?</script>', 'Singleline')
    $newHtml = $regex2.Replace($html, $newBlock, 1)
  }
  if ($newHtml -ne $html) {
    [System.IO.File]::WriteAllText($abs, $newHtml, [System.Text.UTF8Encoding]::new($false))
    Write-Host "✓ $($p.file) 已更新 schema"
    $count++
  } else {
    Write-Host "✗ $($p.file) 未匹配到原 schema"
  }
}

# ----- 处理 4 个缺失页面 -----
foreach ($p in $toAdd) {
  $abs = (Resolve-Path $p.file).Path
  $html = [System.IO.File]::ReadAllText($abs)
  if ($html -match 'application/ld\+json') { Write-Host "− $($p.file) (已有 JSON-LD，跳过)"; continue }
  $url = "https://wedding-tv.cn/$($p.file)"
  $newJson = Build-Schema $p.name $url $p.desc
  $newBlock = "<script type=`"application/ld+json`">`n$newJson`n</script>"
  # 锚点：第一个 emoji icon link 后面
  $iconPattern = '(<link rel="icon" href="data:image/svg\+xml[^"]*" />)'
  $newHtml = [regex]::Replace($html, $iconPattern, "`$1`n$newBlock", 'Singleline')
  if ($newHtml -ne $html) {
    [System.IO.File]::WriteAllText($abs, $newHtml, [System.Text.UTF8Encoding]::new($false))
    Write-Host "✓ $($p.file) 已新增 schema"
    $count++
  } else {
    Write-Host "✗ $($p.file) 未找到 icon 锚点"
  }
}

Write-Host "`n✓ 完成：处理 $count 个工具页"
