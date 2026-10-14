param(
  [Parameter(Mandatory)]
  [ValidateSet('test', 'staging')]
  [string]$TargetEnvironment,

  [Parameter(Mandatory)]
  [string]$Server,

  [Parameter(Mandatory)]
  [string]$Database,

  [Parameter(Mandatory)]
  [string]$ConfirmDatabase,

  [Parameter(Mandatory)]
  [string]$Username
)

$ErrorActionPreference = 'Stop'

if ($Database -cne $ConfirmDatabase) {
  throw 'Database confirmation did not match. No SQL command was run.'
}

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
  throw 'sqlcmd was not found. Install the SQL Server command-line tools before running this verifier.'
}

$securePassword = Read-Host "Password for $Username on $Server" -AsSecureString
$credential = [System.Management.Automation.PSCredential]::new($Username, $securePassword)
$previousSqlcmdPassword = $env:SQLCMDPASSWORD
$env:SQLCMDPASSWORD = $credential.GetNetworkCredential().Password

try {
  foreach ($scriptName in @('verify-schema.sql', 'test-constraints.sql')) {
    $scriptPath = Join-Path $PSScriptRoot $scriptName
    Write-Host "Running $scriptName against the explicitly confirmed $TargetEnvironment database '$Database'..."

    & sqlcmd -S "tcp:$Server,1433" -d $Database -U $Username -N -b -l 15 -t 60 -f 65001 -i $scriptPath
    if ($LASTEXITCODE -ne 0) {
      throw "$scriptName failed with sqlcmd exit code $LASTEXITCODE. No later verification script was run."
    }
  }
} finally {
  if ($null -eq $previousSqlcmdPassword) {
    Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue
  } else {
    $env:SQLCMDPASSWORD = $previousSqlcmdPassword
  }
}
