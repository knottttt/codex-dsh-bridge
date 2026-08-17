[CmdletBinding()]
param(
  [string]$Repository = "knottttt/codex-dsh-bridge",
  [string]$Ref = "main",
  [string]$Profile = "web",
  [switch]$SkipCodex,
  [switch]$SkipDsh
)

$ErrorActionPreference = "Stop"
$MarketplaceName = "codex-dsh-bridge"
$PluginName = "codex-dsh-bridge"
$DshPackageName = "codex-dsh-bridge-companion"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  if ($null -eq (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. $InstallHint"
  }
}

function Invoke-Checked {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "'$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
  }
}

if (-not $SkipCodex) {
  Write-Step "Checking Codex requirements"
  Require-Command "node" "Install Node.js 18 or newer, then open a new terminal."
  Require-Command "codex" "Install or update the Codex CLI, then open a new terminal."

  $marketplaceOutput = & codex plugin marketplace list --json
  if ($LASTEXITCODE -ne 0) {
    throw "Could not read configured Codex marketplaces."
  }

  $marketplaces = ($marketplaceOutput | Out-String | ConvertFrom-Json).marketplaces
  $existingMarketplace = $marketplaces | Where-Object { $_.name -eq $MarketplaceName }

  if ($null -eq $existingMarketplace) {
    Write-Step "Adding the Codex DSH Bridge marketplace"
    Invoke-Checked "codex" @(
      "plugin", "marketplace", "add",
      $Repository,
      "--ref", $Ref,
      "--json"
    )
  }
  else {
    Write-Step "Refreshing the existing Codex DSH Bridge marketplace"
    & codex plugin marketplace upgrade $MarketplaceName --json
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "The marketplace could not be refreshed automatically. The existing source will still be used."
    }
  }

  Write-Step "Installing the Codex plugin"
  Invoke-Checked "codex" @(
    "plugin", "add",
    "$PluginName@$MarketplaceName",
    "--json"
  )
}

if (-not $SkipDsh) {
  Write-Step "Checking DeepSeek Harness requirements"
  Require-Command "node" "Install Node.js 18 or newer, then open a new terminal."
  Require-Command "dsh" "Install DeepSeek Harness, then open a new terminal."

  Write-Step "Installing the Harness companion into the '$Profile' profile"
  Invoke-Checked "dsh" @(
    "plugin",
    "--profile", $Profile,
    "add",
    "github:$Repository#$Ref"
  )
}

Write-Host ""
Write-Host "Codex DSH Bridge installation completed." -ForegroundColor Green
if (-not $SkipDsh) {
  Write-Host "1. Restart the DeepSeek Harness WebUI."
}
if (-not $SkipCodex) {
  Write-Host "2. Start a new Codex task so the plugin and MCP tools are loaded."
}
Write-Host "3. In Harness, open Settings -> Plugins -> Plugin configuration."
Write-Host ""
Write-Host "Installed components:"
if (-not $SkipCodex) {
  Write-Host "  Codex plugin: $PluginName@$MarketplaceName"
}
if (-not $SkipDsh) {
  Write-Host "  DSH package: $DshPackageName ($Profile profile)"
}
