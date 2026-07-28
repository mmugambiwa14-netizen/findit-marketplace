[CmdletBinding()]
param(
  [string]$ProjectRef = 'bwgklpxoetrrkutottdb',
  [string]$BackupRoot = 'C:\Users\mmuga\OneDrive\Documents\FindIt Backups'
)

$ErrorActionPreference = 'Stop'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDirectory = Join-Path $BackupRoot "logical-$timestamp"
$keys = (
  supabase projects api-keys --project-ref $ProjectRef --output json |
    Out-String
) | ConvertFrom-Json
$serviceRoleKey = (
  $keys |
    Where-Object { $_.name -eq 'service_role' } |
    Select-Object -First 1
).api_key

if (-not $serviceRoleKey) {
  throw 'Supabase did not return a legacy service-role key.'
}

$env:FINDIT_SUPABASE_URL = "https://$ProjectRef.supabase.co"
$env:FINDIT_SUPABASE_SECRET_KEY = $serviceRoleKey
$env:FINDIT_ALLOW_HOSTED_BACKUP = 'staging'
$env:FINDIT_EXPECTED_PROJECT_REF = $ProjectRef
$env:FINDIT_BACKUP_DIRECTORY = $outputDirectory

try {
  & node .\scripts\export-staging-logical-backup.mjs
  if ($LASTEXITCODE -ne 0) {
    throw 'Hosted logical backup failed.'
  }
} finally {
  Remove-Item Env:\FINDIT_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_ALLOW_HOSTED_BACKUP -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_EXPECTED_PROJECT_REF -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_BACKUP_DIRECTORY -ErrorAction SilentlyContinue
  $serviceRoleKey = $null
}
