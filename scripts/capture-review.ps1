param(
    [int]$Port = 4304,
    [string]$BindHost = '127.0.0.1',
    [string]$CaptureTag = 'latest'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$prepareScript = Join-Path (Split-Path -Parent $repoRoot) 'prepare-starfall-protocol-local.ps1'
$captureDir = 'W:\Repos\_My Games\LOCAL-ONLY\captures\starfall-protocol'

function Wait-ForHttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                return
            }
        } catch {
            Start-Sleep -Milliseconds 700
        }
    }

    throw "Timed out waiting for $Url"
}

function Get-ChromePath {
    $chromeCommand = Get-Command chrome.exe -ErrorAction SilentlyContinue
    if ($chromeCommand -and (Test-Path $chromeCommand.Source)) {
        return $chromeCommand.Source
    }

    $edgeCommand = Get-Command msedge.exe -ErrorAction SilentlyContinue
    if ($edgeCommand -and (Test-Path $edgeCommand.Source)) {
        return $edgeCommand.Source
    }

    foreach ($candidate in @(
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
    )) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw 'Could not locate Chrome or Edge for capture.'
}

function Invoke-Capture {
    param(
        [string]$ChromePath,
        [string]$Url,
        [string]$OutputPath,
        [string]$ProfileName,
        [string]$WindowSize,
        [int]$BudgetMs = 4000
    )

    $profileDir = Join-Path $env:TEMP $ProfileName
    if (Test-Path $profileDir) {
        Remove-Item -Recurse -Force $profileDir
    }
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

    & $ChromePath `
        '--headless' `
        '--enable-webgl' `
        '--ignore-gpu-blocklist' `
        '--use-angle=swiftshader' `
        '--enable-unsafe-swiftshader' `
        '--run-all-compositor-stages-before-draw' `
        "--user-data-dir=$profileDir" `
        "--window-size=$WindowSize" `
        "--virtual-time-budget=$BudgetMs" `
        "--screenshot=$OutputPath" `
        $Url | Out-Null
}

function Invoke-DomDump {
    param(
        [string]$ChromePath,
        [string]$Url,
        [string]$OutputPath,
        [string]$ProfileName
    )

    $profileDir = Join-Path $env:TEMP $ProfileName
    if (Test-Path $profileDir) {
        Remove-Item -Recurse -Force $profileDir
    }
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

    & $ChromePath `
        '--headless' `
        '--enable-webgl' `
        '--ignore-gpu-blocklist' `
        '--use-angle=swiftshader' `
        '--enable-unsafe-swiftshader' `
        '--run-all-compositor-stages-before-draw' `
        "--user-data-dir=$profileDir" `
        '--virtual-time-budget=4000' `
        '--dump-dom' `
        $Url | Out-File -Encoding utf8 $OutputPath
}

New-Item -ItemType Directory -Force -Path $captureDir | Out-Null

$prepareOutput = & powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $prepareScript
$outputDir = ($prepareOutput | Select-Object -Last 1).ToString().Trim()
if (-not $outputDir -or -not (Test-Path $outputDir)) {
    throw "Expected cached build output at $outputDir"
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Get-NetTCPConnection -LocalPort $Port -State Listen | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force
    }
}

$server = Start-Process python -ArgumentList '-m', 'http.server', $Port, '--bind', $BindHost, '--directory', $outputDir -PassThru

try {
    Wait-ForHttpOk -Url "http://${BindHost}:$Port/"
    $chrome = Get-ChromePath
    $baseUrl = "http://${BindHost}:$Port/"

    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1" -OutputPath (Join-Path $captureDir "review-safehouse-desktop-$CaptureTag.png") -ProfileName 'starfall-review-safehouse-desktop' -WindowSize '1440,1800'
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=insert" -OutputPath (Join-Path $captureDir "review-insert-desktop-$CaptureTag.png") -ProfileName 'starfall-review-insert-desktop' -WindowSize '1440,1100' -BudgetMs 7000
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?autostart=1&review=1" -OutputPath (Join-Path $captureDir "review-mission-desktop-$CaptureTag.png") -ProfileName 'starfall-review-mission-desktop' -WindowSize '1440,1100' -BudgetMs 7000
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=walkthrough" -OutputPath (Join-Path $captureDir "review-walkthrough-desktop-$CaptureTag.png") -ProfileName 'starfall-review-walkthrough-desktop' -WindowSize '1440,1100' -BudgetMs 15000
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=complete" -OutputPath (Join-Path $captureDir "review-result-complete-desktop-$CaptureTag.png") -ProfileName 'starfall-review-result-complete' -WindowSize '1440,1100'
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=failed" -OutputPath (Join-Path $captureDir "review-result-failed-desktop-$CaptureTag.png") -ProfileName 'starfall-review-result-failed' -WindowSize '1440,1100'
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1" -OutputPath (Join-Path $captureDir "review-safehouse-mobile-$CaptureTag.png") -ProfileName 'starfall-review-safehouse-mobile' -WindowSize '390,844'
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=insert" -OutputPath (Join-Path $captureDir "review-insert-mobile-$CaptureTag.png") -ProfileName 'starfall-review-insert-mobile' -WindowSize '390,844' -BudgetMs 7000
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?autostart=1&review=1" -OutputPath (Join-Path $captureDir "review-mission-mobile-$CaptureTag.png") -ProfileName 'starfall-review-mission-mobile' -WindowSize '390,844' -BudgetMs 7000
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=walkthrough" -OutputPath (Join-Path $captureDir "review-walkthrough-mobile-$CaptureTag.png") -ProfileName 'starfall-review-walkthrough-mobile' -WindowSize '390,844' -BudgetMs 15000
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=complete" -OutputPath (Join-Path $captureDir "review-result-complete-mobile-$CaptureTag.png") -ProfileName 'starfall-review-result-complete-mobile' -WindowSize '390,844'
    Invoke-Capture -ChromePath $chrome -Url "${baseUrl}?review=1&reviewState=failed" -OutputPath (Join-Path $captureDir "review-result-failed-mobile-$CaptureTag.png") -ProfileName 'starfall-review-result-failed-mobile' -WindowSize '390,844'
    Invoke-DomDump -ChromePath $chrome -Url "${baseUrl}?review=1" -OutputPath (Join-Path $captureDir "review-safehouse-dom-$CaptureTag.html") -ProfileName 'starfall-review-dom'

    Get-ChildItem $captureDir | Where-Object { $_.Name -like "*$CaptureTag*" } | Sort-Object Name | Select-Object Name, Length, LastWriteTime
} finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
