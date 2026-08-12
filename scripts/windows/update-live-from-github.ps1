$ErrorActionPreference = "Stop"

param(
  [string]$Branch = "hotfix-live-main"
)

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
powershell -ExecutionPolicy Bypass -File $startScript | Out-Host

Write-Host "Live server updated to $(git rev-parse --short HEAD)"
