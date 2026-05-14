# Bump service worker cache version based on date + git short hash
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sw = Join-Path $root "sw.js"
if (-not (Test-Path $sw)) { throw "sw.js not found" }

$hash = "manual"
try {
  $hash = (git -C $root rev-parse --short HEAD).Trim()
} catch {}
$ver = "wt-v3-{0}-{1}" -f (Get-Date -Format "yyyy-MM-dd"), $hash

$text = Get-Content -Path $sw -Raw -Encoding UTF8
$replacement = 'const CACHE = "' + $ver + '";'
$text = [regex]::Replace($text, 'const CACHE = "[^"]+";', $replacement, 1)
[System.IO.File]::WriteAllText($sw, $text, [System.Text.UTF8Encoding]::new($false))
Write-Host "CACHE => $ver"
