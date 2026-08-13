$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
Set-Location $root

function Stop-LiveNodeProcesses {
  $targets = Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match '^node(.exe)?$' -and
      $_.CommandLine -and
      (
        $_.CommandLine -match 'server[\\/]server\.js' -or
        $_.CommandLine -match 'start-safe\.js' -or
        $_.CommandLine -match 'react-scripts'
      )
    }

  foreach ($proc in $targets) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
      Write-Host "Stopped process $($proc.ProcessId)"
    }
    catch {
      Write-Warning "Could not stop process $($proc.ProcessId): $($_.Exception.Message)"
    }
  }
}

Stop-LiveNodeProcesses

$cmd = "cd /d `"$root`" && npm run start:prod"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c $cmd" -WindowStyle Minimized

Write-Host "Live server restart requested from $root"
