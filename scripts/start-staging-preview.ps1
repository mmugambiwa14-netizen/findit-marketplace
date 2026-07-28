[CmdletBinding()]
param(
  [string]$ProjectRef = 'bwgklpxoetrrkutottdb',
  [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$listener = Get-NetTCPConnection `
  -LocalAddress 127.0.0.1 `
  -LocalPort $Port `
  -State Listen `
  -ErrorAction SilentlyContinue

if ($listener) {
  [pscustomobject]@{
    status = 'already running'
    port = $Port
    process_id = $listener.OwningProcess
  } | ConvertTo-Json
  exit 0
}

$keys = (
  supabase projects api-keys --project-ref $ProjectRef --output json |
    Out-String
) | ConvertFrom-Json
$publicKey = (
  $keys |
    Where-Object { $_.type -eq 'publishable' } |
    Select-Object -First 1
).api_key

if (-not $publicKey) {
  throw 'Supabase did not return a publishable API key.'
}

$env:VITE_SUPABASE_URL = "https://$ProjectRef.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = $publicKey
$env:VITE_AUTH_GOOGLE_ENABLED = if ($env:FINDIT_AUTH_GOOGLE_ENABLED -eq 'true') { 'true' } else { 'false' }
$env:VITE_AUTH_APPLE_ENABLED = if ($env:FINDIT_AUTH_APPLE_ENABLED -eq 'true') { 'true' } else { 'false' }
$env:VITE_FEATURE_BUSINESS_PROFILES = 'true'
$env:VITE_FEATURE_MESSAGING = 'true'
$env:VITE_FEATURE_ESSENTIAL_NOTIFICATIONS = 'true'
$env:VITE_FEATURE_TOURS = 'false'
$env:VITE_FEATURE_TOURS_PREVIEW = 'true'
$env:TOURS_BACKEND_ENABLED = 'false'
$env:VITE_FEATURE_PAYMENTS = 'false'
$env:VITE_FEATURE_SUBSCRIPTIONS = 'false'
$env:VITE_FEATURE_ESCROW = 'false'
$env:VITE_FEATURE_PREMIUM_LISTINGS = 'false'
$env:VITE_FEATURE_AI_MODERATION = 'false'
$env:VITE_FEATURE_AI_BAN_EVASION = 'false'
$env:VITE_FEATURE_AI_TICKET_TRIAGE = 'false'
$env:VITE_FEATURE_AI_SUPPORT_CHAT = 'false'
$env:VITE_FEATURE_SCHEDULED_REMINDERS = 'false'
$env:VITE_FEATURE_MARKETING_EMAILS = 'false'

try {
  $process = Start-Process `
    -FilePath 'npm.cmd' `
    -ArgumentList @(
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      $Port,
      '--strictPort'
    ) `
    -WindowStyle Hidden `
    -PassThru

  [pscustomobject]@{
    status = 'started'
    port = $Port
    process_id = $process.Id
    supabase_project = $ProjectRef
    mvp_flags = 'enabled'
  } | ConvertTo-Json
} finally {
  Remove-Item Env:\VITE_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_AUTH_GOOGLE_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_AUTH_APPLE_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_BUSINESS_PROFILES -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_MESSAGING -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_ESSENTIAL_NOTIFICATIONS -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_TOURS -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_TOURS_PREVIEW -ErrorAction SilentlyContinue
  Remove-Item Env:\TOURS_BACKEND_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_PAYMENTS -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_SUBSCRIPTIONS -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_ESCROW -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_PREMIUM_LISTINGS -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_AI_MODERATION -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_AI_BAN_EVASION -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_AI_TICKET_TRIAGE -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_AI_SUPPORT_CHAT -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_SCHEDULED_REMINDERS -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_FEATURE_MARKETING_EMAILS -ErrorAction SilentlyContinue
  $publicKey = $null
}
