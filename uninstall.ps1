[CmdletBinding()]
param(
  [string]$Profile = "web",
  [switch]$KeepMarketplace,
  [switch]$RemoveSettings
)

$ErrorActionPreference = "Stop"
$MarketplaceName = "codex-dsh-bridge"
$PluginName = "codex-dsh-bridge"
$DshPackageName = "codex-dsh-bridge-companion"

function Invoke-BestEffort {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$Description
  )

  if ($null -eq (Get-Command $Command -ErrorAction SilentlyContinue)) {
    Write-Warning "$Description was skipped because '$Command' was not found."
    return
  }

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "$Description did not complete successfully. It may already be removed."
  }
}

Write-Host "Removing the Codex plugin..."
Invoke-BestEffort "codex" @(
  "plugin", "remove",
  "$PluginName@$MarketplaceName",
  "--json"
) "Codex plugin removal"

if (-not $KeepMarketplace) {
  Write-Host "Removing the Codex marketplace..."
  Invoke-BestEffort "codex" @(
    "plugin", "marketplace", "remove",
    $MarketplaceName,
    "--json"
  ) "Codex marketplace removal"
}

Write-Host "Removing the Harness companion..."
Invoke-BestEffort "dsh" @(
  "plugin",
  "--profile", $Profile,
  "remove",
  $DshPackageName
) "Harness companion removal"

if ($RemoveSettings) {
  $dshRoot = if ([string]::IsNullOrWhiteSpace($env:DSH_HOME)) {
    Join-Path ([Environment]::GetFolderPath("UserProfile")) ".dsh"
  }
  else {
    $env:DSH_HOME
  }
  $settingsPath = Join-Path $dshRoot "codex-dsh-bridge.json"
  if (Test-Path -LiteralPath $settingsPath) {
    Remove-Item -LiteralPath $settingsPath -Force
    Write-Host "Removed settings: $settingsPath"
  }
}

Write-Host ""
Write-Host "Uninstall completed. Restart Harness and start a new Codex task." -ForegroundColor Green
