# 重排 blog.html 的卡片：按地理分区分组并加锚点 H3
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
$file = 'blog.html'
$abs = (Resolve-Path $file).Path
$html = [System.IO.File]::ReadAllText($abs)

# 分区顺序定义
$zones = [ordered]@{
  '华北' = @{ id='zone-huabei';   label='华北地区（5 省市）'; emoji='🏛️' }
  '东北' = @{ id='zone-dongbei';  label='东北地区（3 省）';   emoji='❄️' }
  '华东' = @{ id='zone-huadong';  label='华东地区（8 省市）'; emoji='🏙️' }
  '华中' = @{ id='zone-huazhong'; label='华中地区（3 省）';   emoji='🌾' }
  '华南' = @{ id='zone-huanan';   label='华南地区（5 省市）'; emoji='🌴' }
  '西南' = @{ id='zone-xinan';    label='西南地区（5 省市）'; emoji='⛰️' }
  '西北' = @{ id='zone-xibei';    label='西北地区（5 省区）'; emoji='🐪' }
}

# 抽出现有所有 card 行 (在 #regions + .grid 那个 grid 里)
$gridPattern = '(<div class="grid">)(\s*<a class="card" href="/blog/[\s\S]*?</a>\s*)+(</div>\s*<!-- AdSense ad2)'
if ($html -notmatch $gridPattern) {
  Write-Host "✗ 未找到目标 grid"; exit 1
}

# 提取所有 card 字符串
$cardRegex = [regex]'<a class="card" href="/blog/[^"]+">[\s\S]*?</a>'
$gridBlockRegex = [regex]'<div class="grid">\s*(?:<a class="card" href="/blog/[\s\S]*?</a>\s*)+</div>\s*<!-- AdSense ad2'
$gridMatch = $gridBlockRegex.Match($html)
$gridContent = $gridMatch.Value
$cards = $cardRegex.Matches($gridContent) | ForEach-Object { $_.Value }

Write-Host "提取 $($cards.Count) 张卡片"

# 按 tag 分组
$grouped = @{}
foreach ($z in $zones.Keys) { $grouped[$z] = @() }
foreach ($card in $cards) {
  if ($card -match '<span class="tag">([^<]+)</span>') {
    $zone = $matches[1]
    if ($grouped.ContainsKey($zone)) {
      $grouped[$zone] += $card
    }
  }
}

# 构建新 grid 内容
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<div class="grid">')
foreach ($z in $zones.Keys) {
  $info = $zones[$z]
  [void]$sb.AppendLine("  <h3 id=`"$($info.id)`" class=`"zone-heading`" style=`"grid-column:1/-1;margin:18px 0 4px;font-size:18px;color:var(--accent,#d4a574);border-bottom:1px solid var(--line,#2a2030);padding-bottom:8px`">$($info.emoji) $($info.label)</h3>")
  foreach ($card in $grouped[$z]) {
    [void]$sb.AppendLine("  $card")
  }
}
[void]$sb.AppendLine('</div>')
[void]$sb.Append('<!-- AdSense ad2')

$newHtml = $gridBlockRegex.Replace($html, $sb.ToString(), 1)

[System.IO.File]::WriteAllText($abs, $newHtml, [System.Text.UTF8Encoding]::new($false))
Write-Host "✓ blog.html 已按地理分区重排"
