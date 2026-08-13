$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$updateScriptPath = Join-Path $root "scripts\windows\update-live-from-github.ps1"

$expectedScript = @'
$ErrorActionPreference = "Stop"

$Branch = if ($args.Count -gt 0 -and $args[0]) {
  [string]$args[0]
} elseif ($env:LIVE_UPDATE_BRANCH) {
  [string]$env:LIVE_UPDATE_BRANCH
} else {
  "hotfix-live-main"
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

Require-Command "git"
Require-Command "npm"

$currentHead = (git rev-parse HEAD).Trim()
git fetch origin $Branch | Out-Host
$remoteHead = (git rev-parse ("origin/" + $Branch)).Trim()

if ($currentHead -eq $remoteHead) {
  Write-Host "No new code on origin/$Branch"
  exit 0
}

git pull --ff-only origin $Branch | Out-Host

$changedFiles = git diff --name-only $currentHead HEAD
$needsInstall = $false

foreach ($file in $changedFiles) {
  if ($file -eq "package.json" -or $file -eq "package-lock.json") {
    $needsInstall = $true
  }
}

if ($needsInstall) {
  npm install | Out-Host
}

npm run build | Out-Host

$startScript = Join-Path $root "scripts\\windows\\start-live-server.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File $startScript | Out-Host

Write-Host "Live server updated to $(git rev-parse --short HEAD)"
'@

[System.IO.File]::WriteAllText($updateScriptPath, $expectedScript + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Host "Refreshed updater script: $updateScriptPath"

if ($args.Count -gt 0) {
  powershell -NoProfile -ExecutionPolicy Bypass -File $updateScriptPath @args
} else {
  powershell -NoProfile -ExecutionPolicy Bypass -File $updateScriptPath
}
