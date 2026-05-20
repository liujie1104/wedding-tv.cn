# 移除 sitemap.xml 中所有英文 stub URL（已加 noindex 的页面不应在 sitemap）
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
$path = Join-Path (Get-Location) 'sitemap.xml'
$xml = [System.IO.File]::ReadAllText($path)
$orig = $xml

# 1) 删除整段 <url>...英文 stub loc...</url>
$stubPattern = '(?s)\s*<url>\s*<loc>https://wedding-tv\.cn/[a-zA-Z0-9-]*-?en\.html</loc>.*?</url>'
$xml = [regex]::Replace($xml, $stubPattern, '')

# 2) 删除残留的 <xhtml:link ... -en.html> 引用
$linkPattern = '\s*<xhtml:link[^>]*-?en\.html[^>]*/>'
$xml = [regex]::Replace($xml, $linkPattern, '')

# 3) guide.html 的 hreflang en 也要删（guide-en 已 noindex）
# 上一步已覆盖

# 4) 清理多个连续空行
$xml = [regex]::Replace($xml, '(\r?\n){3,}', "`r`n`r`n")

if ($xml -ne $orig) {
  [System.IO.File]::WriteAllText($path, $xml, [System.Text.UTF8Encoding]::new($false))
  $before = ([regex]::Matches($orig, '<loc>')).Count
  $after = ([regex]::Matches($xml, '<loc>')).Count
  Write-Host "✓ sitemap.xml 清理完成：$before URL → $after URL（移除 $($before - $after) 个英文 stub）"
} else {
  Write-Host "· sitemap.xml 无变化"
}
