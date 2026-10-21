# Runs a Discover k6 test with variables loaded from .env (k6 does not read .env itself).
# Usage: .\scripts\run-discover.ps1 k6-tests/Discover/repost/TC01-baseline.js [extra k6 args]
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Test,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$K6Args
)

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  Write-Error ".env not found. Copy .env.example to .env and set API_KEY."
  exit 1
}

foreach ($line in Get-Content $envFile) {
  $line = $line.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { continue }
  $idx = $line.IndexOf("=")
  if ($idx -lt 1) { continue }
  $name  = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
  if ($value -ne "") { Set-Item -Path "Env:$name" -Value $value }
}

Set-Location $root
& k6 run $Test @K6Args
exit $LASTEXITCODE
