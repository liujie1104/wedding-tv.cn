# 统计每个 HTML 页面的"可见文本"字数（去掉 script/style/标签）
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$files = Get-ChildItem -Recurse -Filter *.html | Where-Object {
  $_.FullName -notmatch '\\node_modules\\|\\\.git\\|\\dist\\'
}

$results = @()
foreach ($f in $files) {
  $html = [System.IO.File]::ReadAllText($f.FullName)
  # 去掉 script/style/JSON-LD
  $clean = [regex]::Replace($html, '(?is)<script[^>]*>.*?</script>', ' ')
  $clean = [regex]::Replace($clean, '(?is)<style[^>]*>.*?</style>', ' ')
  $clean = [regex]::Replace($clean, '(?is)<!--.*?-->', ' ')
  # 去掉所有 HTML 标签
  $text = [regex]::Replace($clean, '<[^>]+>', ' ')
  # 解码常见实体
  $text = $text -replace '&nbsp;', ' ' -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"'
  # 压缩空白
  $text = [regex]::Replace($text, '\s+', ' ').Trim()
  # 中文字符数 + 英文单词数
  $cnCount = ([regex]::Matches($text, '[\u4e00-\u9fa5]')).Count
  $enCount = ([regex]::Matches($text, '[A-Za-z]{2,}')).Count
  $total = $cnCount + $enCount
  $rel = $f.FullName.Replace((Get-Location).Path + '\', '')
  $results += [pscustomobject]@{
    File = $rel
    Chinese = $cnCount
    EnWords = $enCount
    Total = $total
  }
}

$results | Sort-Object Total | Format-Table -AutoSize | Out-String -Width 200
Write-Host "`n=== 字数 < 600 的页面（可能被判低价值）==="
$results | Where-Object { $_.Total -lt 600 } | Sort-Object Total | Format-Table -AutoSize | Out-String -Width 200
