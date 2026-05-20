# Step A：从瘦页面移除 AdSense <ins> 广告位（保留 head 中的 script 引用做账号关联）
# Step C：给英文 stub 页加 noindex
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

# 中文工具页（字数 < 600）
$thinCn = @(
  'mv-style.html','speech.html','vows.html','countdown.html','playlist.html',
  'qr-poster.html','timeline-templates.html','budget-reference.html','almanac.html',
  'calculator.html','invitation.html','poster.html','checklist.html','timeline.html'
)
# 英文 stub 页（同时加 noindex 处理）
$enStubs = @(
  'en.html','tools-en.html','blog-global-en.html','blog-global-japan-en.html',
  'blog-global-korea-en.html','blog-global-india-en.html','blog-global-western-en.html',
  'checklist-en.html','timeline-en.html','poster-en.html','invitation-en.html',
  'calculator-en.html','about-en.html','privacy-en.html','guide-en.html'
)

# 同时处理两组（都先移除广告位）
$allTargets = $thinCn + $enStubs | Select-Object -Unique

$removedAdsTotal = 0
$noindexAddedTotal = 0

foreach ($file in $allTargets) {
  $path = Join-Path (Get-Location) $file
  if (-not (Test-Path $path)) { Write-Host "  跳过（不存在）: $file"; continue }
  $html = [System.IO.File]::ReadAllText($path)
  $orig = $html
  
  # 移除 <!-- AdSense slot ... --> 注释 + 包含 <ins class="adsbygoogle"> 的 <div class="ad-slot">...</div>
  # 模式 1：完整 ad-slot 块（含注释 + div）
  $pattern1 = '(?s)\s*<!--\s*AdSense slot[^>]*-->\s*<div class="ad-slot"[^>]*>\s*<ins class="adsbygoogle"[^>]*></ins>\s*<script>\(adsbygoogle[^<]*</script>\s*</div>'
  $html = [regex]::Replace($html, $pattern1, '')
  # 模式 2：仅 div 块（无注释）
  $pattern2 = '(?s)\s*<div class="ad-slot"[^>]*>\s*<ins class="adsbygoogle"[^>]*></ins>\s*<script>\(adsbygoogle[^<]*</script>\s*</div>'
  $html = [regex]::Replace($html, $pattern2, '')
  # 模式 3：裸 <ins>（无 div 包装）
  $pattern3 = '(?s)\s*<ins class="adsbygoogle"[^>]*></ins>\s*<script>\(adsbygoogle[^<]*</script>'
  $html = [regex]::Replace($html, $pattern3, '')
  
  $adsRemoved = ([regex]::Matches($orig, 'class="adsbygoogle"')).Count - ([regex]::Matches($html, 'class="adsbygoogle"')).Count
  
  # 英文 stub：加 noindex
  if ($enStubs -contains $file) {
    if ($html -match '<meta name="robots"[^>]*>') {
      $html = [regex]::Replace($html, '<meta name="robots"[^>]*>', '<meta name="robots" content="noindex,nofollow" />')
    } elseif ($html -match '<head[^>]*>') {
      $html = [regex]::Replace($html, '(<head[^>]*>)', "`$1`n<meta name=`"robots`" content=`"noindex,nofollow`" />", 1)
    }
    $noindexAddedTotal++
  }
  
  if ($html -ne $orig) {
    [System.IO.File]::WriteAllText($path, $html, [System.Text.UTF8Encoding]::new($false))
    $removedAdsTotal += $adsRemoved
    Write-Host "  ✓ $file  (移除 $adsRemoved 个广告位)"
  } else {
    Write-Host "  · $file  (无变化)"
  }
}

Write-Host ""
Write-Host "Step A 汇总：移除 $removedAdsTotal 个广告位"
Write-Host "Step C 汇总：$noindexAddedTotal 个英文 stub 已加 noindex"
