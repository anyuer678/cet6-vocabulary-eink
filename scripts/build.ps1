# CET-6 Build Script
# Usage: .\scripts\build.ps1 [eink|regular|all] ["changelog"]
#
# Key: Eink copies directly from www-eink/ to android-eink/, never touches android/
#      Regular uses capacitor sync from www/ to android/
#      The two versions are completely independent.

param(
    [string]$Target = "all",
    [string]$Changelog = ""
)

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot | Split-Path -Parent
$date = Get-Date -Format "yyyyMMdd"

$backupDir = "$projectDir\dist\backup\$date"
$maxSeq = 0
if (Test-Path $backupDir) {
    $dirs = Get-ChildItem $backupDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d{3}$' }
    foreach ($dir in $dirs) {
        $num = [int]$dir.Name
        if ($num -gt $maxSeq) { $maxSeq = $num }
    }
}
$seq = ($maxSeq + 1).ToString("D3")
$version = "1.0.$date.$seq"

Write-Host "=== CET-6 Build v$version ===" -ForegroundColor Cyan

function Update-Version($buildDir, $verName) {
    $gradle = "$projectDir\$buildDir\app\build.gradle"
    $content = Get-Content $gradle -Raw
    $seqNum = [int]$seq
    $content = $content -replace 'versionCode \d+', "versionCode $seqNum"
    $old = 'versionName "[^"]*"'
    $new = "versionName `"$verName`""
    $content = $content -replace $old, $new
    Set-Content $gradle -Value $content -NoNewline
}

$backupDir = "$projectDir\dist\backup\$date\$seq"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

function Build-Eink {
    Write-Host "`n--- Building Eink ---" -ForegroundColor Green
    
    # Copy directly from www-eink to android-eink (no capacitor sync!)
    $einkAssets = "$projectDir\android-eink\app\src\main\assets\public"
    Remove-Item $einkAssets -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $einkAssets -Force | Out-Null
    Copy-Item "$projectDir\www-eink\*" $einkAssets -Recurse -Force
    
    $idx = "$einkAssets\index.html"
    if (-not (Test-Path $idx)) {
        Write-Host "  ERROR: eink index.html missing!" -ForegroundColor Red
        return
    }
    Write-Host "  Copied www-eink -> android-eink ($((Get-Item $idx).Length) bytes)" -ForegroundColor Gray
    
    Update-Version "android-eink" "$version-eink"
    $env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
    Push-Location "$projectDir\android-eink"
    & .\gradlew.bat assembleDebug 2>&1 | Out-Host
    Pop-Location
    
    $apkName = "cet6-eink-v$version.apk"
    Copy-Item "$projectDir\android-eink\app\build\outputs\apk\debug\app-debug.apk" "$projectDir\dist\$apkName" -Force
    Copy-Item "$projectDir\dist\$apkName" "$backupDir\$apkName" -Force
    Write-Host "  -> dist\$apkName" -ForegroundColor Cyan
}

function Build-Regular {
    Write-Host "`n--- Building Regular ---" -ForegroundColor Green
    
    # Sync regular version
    Remove-Item "$projectDir\android\app\src\main\assets\public" -Recurse -Force -ErrorAction SilentlyContinue
    Push-Location $projectDir
    npx cap sync android 2>&1 | Out-Null
    Pop-Location
    
    $idx = "$projectDir\android\app\src\main\assets\public\index.html"
    if (-not (Test-Path $idx)) {
        Write-Host "  ERROR: regular index.html missing!" -ForegroundColor Red
        return
    }
    Write-Host "  Synced www -> android ($((Get-Item $idx).Length) bytes)" -ForegroundColor Gray
    
    Update-Version "android" $version
    $env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
    Push-Location "$projectDir\android"
    & .\gradlew.bat assembleDebug 2>&1 | Out-Host
    Pop-Location
    
    $apkName = "cet6-regular-v$version.apk"
    Copy-Item "$projectDir\android\app\build\outputs\apk\debug\app-debug.apk" "$projectDir\dist\$apkName" -Force
    Copy-Item "$projectDir\dist\$apkName" "$backupDir\$apkName" -Force
    Write-Host "  -> dist\$apkName" -ForegroundColor Cyan
}

switch ($Target) {
    "eink" { Build-Eink }
    "regular" { Build-Regular }
    "all" { Build-Eink; Build-Regular }
    default { Write-Host "Unknown target: $Target" -ForegroundColor Red; exit 1 }
}

$changelogFile = "$backupDir\changelog.txt"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm"
$content = "v$version ($ts)`n"
if ($Changelog) { $content += $Changelog + "`n" }
else { $content += "UI/功能更新`n" }
Set-Content $changelogFile -Value $content -Encoding UTF8

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "Backup: dist\backup\$date\$seq\" -ForegroundColor Gray
Get-ChildItem "$projectDir\dist\*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 4 Name, @{N='MB';E={[math]::Round($_.Length/1MB,2)}} | Format-Table
