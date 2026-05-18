# 批量给 34 个 blog 页添加 Twitter Card meta
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$regions = 'beijing','tianjin','hebei','shanxi','neimenggu','liaoning','jilin','heilongjiang','shanghai','jiangsu','zhejiang','anhui','fujian','jiangxi','shandong','taiwan','henan','hubei','hunan','guangdong','guangxi','hainan','xianggang','aomen','chongqing','sichuan','guizhou','yunnan','xizang','shaanxi','gansu','qinghai','ningxia','xinjiang'

$count = 0
foreach ($r in $regions) {
  $file = "blog\$r.html"
  if (-not (Test-Path $file)) { continue }
  $abs = (Resolve-Path $file).Path
  $html = [System.IO.File]::ReadAllText($abs)

  if ($html -match 'twitter:card') {
    Write-Host "− $file (已有)"; continue
  }

  # 提取已有 og:title 和 og:description
  $ogTitle = if ($html -match '<meta property="og:title" content="([^"]+)"') { $matches[1] } else { '' }
  $ogDesc  = if ($html -match '<meta property="og:description" content="([^"]+)"') { $matches[1] } else { '' }

  $twitterMeta = "<meta name=`"twitter:card`" content=`"summary_large_image`" />`n<meta name=`"twitter:title`" content=`"$ogTitle`" />`n<meta name=`"twitter:description`" content=`"$ogDesc`" />`n<meta name=`"twitter:image`" content=`"https://wedding-tv.cn/og.png`" />"

  # 插入到 og:image 那一行之后
  $pattern = '(<meta property="og:image" content="[^"]+" />)'
  $newHtml = [regex]::Replace($html, $pattern, "`$1`n$twitterMeta", 'Singleline')

  if ($newHtml -ne $html) {
    [System.IO.File]::WriteAllText($abs, $newHtml, [System.Text.UTF8Encoding]::new($false))
    Write-Host "✓ $file"
    $count++
  } else {
    Write-Host "✗ $file 未找到 og:image 锚点"
  }
}

Write-Host "`n✓ 完成：$count 个 blog 已添加 Twitter Card"
