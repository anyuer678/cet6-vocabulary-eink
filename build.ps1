param([ValidateSet("www","apk","exe","all")][string]$Target="all")
$ErrorActionPreference = "Stop"
Write-Host "word-eink build:$Target" -ForegroundColor Cyan
npm run "build:$Target"
if ($LASTEXITCODE -eq 0) { Write-Host "word-eink build:$Target OK" -ForegroundColor Green }
