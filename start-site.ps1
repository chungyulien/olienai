$ErrorActionPreference = "Stop"

$bundledNode = "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$node = $null

if (Test-Path $bundledNode) {
  $node = $bundledNode
} else {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    $node = $command.Source
  }
}

if (-not $node) {
  Write-Host "找不到 Node.js，請先安裝 Node.js 18 以上版本。"
  exit 1
}

Set-Location $PSScriptRoot
Write-Host "網站啟動中：http://localhost:3000"
& $node server.js
