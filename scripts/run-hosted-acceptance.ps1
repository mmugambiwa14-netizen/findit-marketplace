[CmdletBinding()]
param(
  [string]$ProjectRef = 'bwgklpxoetrrkutottdb',
  [string[]]$Suites = @(
    'test:auth-hosted',
    'test:owner-listings-hosted',
    'test:services-hosted',
    'test:admin-hosted',
    'test:business-profiles-hosted',
    'test:listing-creation-hosted',
    'test:messaging-hosted',
    'test:notifications-hosted',
    'test:search-scale-hosted'
  )
)

$ErrorActionPreference = 'Stop'
$keys = (
  supabase projects api-keys --project-ref $ProjectRef --output json |
    Out-String
) | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
  throw 'Supabase API key lookup failed.'
}

$publicKey = (
  $keys |
    Where-Object { $_.type -eq 'publishable' } |
    Select-Object -First 1
).api_key
$serviceRoleKey = (
  $keys |
    Where-Object { $_.name -eq 'service_role' } |
    Select-Object -First 1
).api_key

if (-not $publicKey -or -not $serviceRoleKey) {
  throw 'Supabase did not return the required publishable and legacy service-role keys.'
}

$env:FINDIT_SUPABASE_URL = "https://$ProjectRef.supabase.co"
$env:FINDIT_SUPABASE_ANON_KEY = $publicKey
$env:FINDIT_SUPABASE_SECRET_KEY = $serviceRoleKey
$env:FINDIT_ALLOW_HOSTED_SMOKE = 'staging'
$env:FINDIT_EXPECTED_PROJECT_REF = $ProjectRef
$env:FINDIT_SMOKE_ORIGIN = 'https://mmugambiwa14-netizen.github.io'

try {
  foreach ($suite in $Suites) {
    Write-Host "Running $suite"
    & npm run $suite
    if ($LASTEXITCODE -ne 0) {
      throw "$suite failed."
    }
  }
} finally {
  Remove-Item Env:\FINDIT_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_ALLOW_HOSTED_SMOKE -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_EXPECTED_PROJECT_REF -ErrorAction SilentlyContinue
  Remove-Item Env:\FINDIT_SMOKE_ORIGIN -ErrorAction SilentlyContinue
  $publicKey = $null
  $serviceRoleKey = $null
}
