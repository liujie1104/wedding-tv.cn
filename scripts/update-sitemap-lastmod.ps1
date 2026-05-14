# Update sitemap.xml <lastmod> from file modification time
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "sitemap.xml"
if (-not (Test-Path $path)) { throw "sitemap.xml not found" }

[xml]$xml = Get-Content -Path $path -Raw -Encoding UTF8
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("sm", "http://www.sitemaps.org/schemas/sitemap/0.9")

$base = "https://wedding-tv.cn"
$nodes = $xml.SelectNodes("//sm:url", $ns)
$count = 0
foreach ($u in $nodes) {
  $locNode = $u.SelectSingleNode("sm:loc", $ns)
  if (-not $locNode) { continue }
  $loc = $locNode.InnerText.Trim()
  if (-not $loc.StartsWith($base)) { continue }
  $rel = $loc.Substring($base.Length)
  if ([string]::IsNullOrWhiteSpace($rel) -or $rel -eq "/") {
    $rel = "/index.html"
  }
  $rel = $rel.TrimStart('/')
  $fp = Join-Path $root $rel
  if (-not (Test-Path $fp)) { continue }

  $d = (Get-Item $fp).LastWriteTime.ToString("yyyy-MM-dd")
  $lastmod = $u.SelectSingleNode("sm:lastmod", $ns)
  if (-not $lastmod) {
    $lastmod = $xml.CreateElement("lastmod", "http://www.sitemaps.org/schemas/sitemap/0.9")
    $u.AppendChild($lastmod) | Out-Null
  }
  if ($lastmod.InnerText -ne $d) {
    $lastmod.InnerText = $d
    $count++
  }
}

$xml.Save($path)
Write-Host "updated lastmod count: $count"
