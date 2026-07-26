param(
  [ValidateSet("start", "status", "stop")]
  [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

function Get-TailscaleCommand {
  $command = Get-Command tailscale -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $installedPath = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
  if (Test-Path -LiteralPath $installedPath) {
    return $installedPath
  }

  throw "Tailscale n'est pas installé. Installez-le depuis https://tailscale.com/download/windows puis connectez cette machine."
}

$tailscale = Get-TailscaleCommand

switch ($Action) {
  "start" {
    & $tailscale serve --bg 5173
    if ($LASTEXITCODE -ne 0) {
      throw "Impossible d'activer Tailscale Serve."
    }
    & $tailscale serve status
  }
  "status" {
    & $tailscale serve status
  }
  "stop" {
    & $tailscale serve reset
    if ($LASTEXITCODE -ne 0) {
      throw "Impossible de désactiver Tailscale Serve."
    }
    Write-Output "Accès distant Consilium désactivé."
  }
}
