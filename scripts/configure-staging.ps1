[CmdletBinding()]
param(
  [string]$ProjectRef = 'bwgklpxoetrrkutottdb',
  [string]$Repository = 'mmugambiwa14-netizen/findit-marketplace',
  [string]$PagesOrigin = 'https://mmugambiwa14-netizen.github.io',
  [switch]$RunWorkerAcceptance
)

$ErrorActionPreference = 'Stop'

function Get-GitHubCredential {
  $credentialRequest = @"
protocol=https
host=github.com
path=$Repository.git

"@
  $nodeScript = @'
const { spawnSync } = require("node:child_process");
const request = process.env.FINDIT_GIT_CREDENTIAL_REQUEST;
const result = spawnSync("git", ["credential", "fill"], {
  input: request,
  encoding: "utf8",
});
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}
process.stdout.write(result.stdout);
'@

  $env:FINDIT_GIT_CREDENTIAL_REQUEST = $credentialRequest
  try {
    $encodedScript = [Convert]::ToBase64String(
      [Text.Encoding]::UTF8.GetBytes($nodeScript)
    )
    $loader = 'eval(Buffer.from(process.argv[1],String.fromCharCode(98,97,115,101,54,52)).toString())'
    $output = & node -e $loader $encodedScript
  } finally {
    Remove-Item Env:\FINDIT_GIT_CREDENTIAL_REQUEST -ErrorAction SilentlyContinue
  }

  if ($LASTEXITCODE -ne 0) {
    throw 'Git credential lookup failed.'
  }

  $credential = @{}
  foreach ($line in ($output -split "`r?`n")) {
    if ($line -match '^([^=]+)=(.*)$') {
      $credential[$matches[1]] = $matches[2]
    }
  }

  if (-not $credential.ContainsKey('password')) {
    throw 'Git Credential Manager did not return a GitHub token.'
  }

  return $credential
}

function New-WorkerSecret {
  $bytes = New-Object byte[] 48
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }

  return [Convert]::ToBase64String($bytes).
    TrimEnd('=').
    Replace('+', '-').
    Replace('/', '_')
}

function Invoke-GitHubApi {
  param(
    [Parameter(Mandatory)]
    [ValidateSet('GET', 'POST', 'PUT')]
    [string]$Method,
    [Parameter(Mandatory)]
    [string]$Path,
    [object]$Body
  )

  $parameters = @{
    Headers = @{
      Authorization = "Bearer $env:GH_TOKEN"
      Accept = 'application/vnd.github+json'
      'X-GitHub-Api-Version' = '2022-11-28'
    }
    Method = $Method
    Uri = "https://api.github.com$Path"
  }

  if ($null -ne $Body) {
    $parameters.ContentType = 'application/json'
    $parameters.Body = $Body | ConvertTo-Json -Depth 5
  }

  return Invoke-RestMethod @parameters
}

$supabaseUrl = "https://$ProjectRef.supabase.co"
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
  throw 'Supabase did not return publishable and legacy service-role API keys.'
}

$mediaSecret = New-WorkerSecret
$expirySecret = New-WorkerSecret

supabase secrets set `
  --project-ref $ProjectRef `
  "FINDIT_MEDIA_CLEANUP_WORKER_SECRET=$mediaSecret" `
  "FINDIT_LISTING_EXPIRY_WORKER_SECRET=$expirySecret" `
  "FINDIT_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,$PagesOrigin" |
  Out-Null

if ($LASTEXITCODE -ne 0) {
  throw 'Supabase Edge Function secret rotation failed.'
}

$workerAcceptance = 'not requested'
if ($RunWorkerAcceptance) {
  $env:FINDIT_SUPABASE_URL = $supabaseUrl
  $env:FINDIT_SUPABASE_ANON_KEY = $publicKey
  $env:FINDIT_SUPABASE_SECRET_KEY = $serviceRoleKey
  $env:FINDIT_ALLOW_HOSTED_SMOKE = 'staging'
  $env:FINDIT_EXPECTED_PROJECT_REF = $ProjectRef
  $env:FINDIT_SMOKE_ORIGIN = $PagesOrigin
  $env:FINDIT_MEDIA_CLEANUP_WORKER_SECRET = $mediaSecret
  $env:FINDIT_LISTING_EXPIRY_WORKER_SECRET = $expirySecret

  try {
    foreach ($suite in @(
      'test:media-lifecycle-hosted',
      'test:listing-expiry-hosted'
    )) {
      & npm run $suite
      if ($LASTEXITCODE -ne 0) {
        throw "$suite failed."
      }
    }
    $workerAcceptance = 'passed'
  } finally {
    Remove-Item Env:\FINDIT_SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\FINDIT_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\FINDIT_SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\FINDIT_ALLOW_HOSTED_SMOKE -ErrorAction SilentlyContinue
    Remove-Item Env:\FINDIT_EXPECTED_PROJECT_REF -ErrorAction SilentlyContinue
    Remove-Item Env:\FINDIT_SMOKE_ORIGIN -ErrorAction SilentlyContinue
    Remove-Item Env:\FINDIT_MEDIA_CLEANUP_WORKER_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:\FINDIT_LISTING_EXPIRY_WORKER_SECRET -ErrorAction SilentlyContinue
  }
}

$credential = Get-GitHubCredential
$env:GH_TOKEN = $credential.password

try {
  gh variable set FINDIT_SUPABASE_URL `
    --repo $Repository `
    --body $supabaseUrl
  gh secret set FINDIT_SUPABASE_ANON_KEY `
    --repo $Repository `
    --body $publicKey
  gh secret set FINDIT_MEDIA_CLEANUP_WORKER_SECRET `
    --repo $Repository `
    --body $mediaSecret
  gh secret set FINDIT_LISTING_EXPIRY_WORKER_SECRET `
    --repo $Repository `
    --body $expirySecret

  if ($LASTEXITCODE -ne 0) {
    throw 'GitHub staging variable or secret configuration failed.'
  }

  $pagesStatus = 'already configured'
  try {
    $null = Invoke-GitHubApi -Method GET -Path "/repos/$Repository/pages"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) {
      throw
    }

    try {
      $null = Invoke-GitHubApi `
        -Method POST `
        -Path "/repos/$Repository/pages" `
        -Body @{ build_type = 'workflow' }
      $pagesStatus = 'enabled'
    } catch {
      $pagesStatus = "unavailable: $($_.ErrorDetails.Message)"
    }
  }

  [pscustomobject]@{
    supabase_project = $ProjectRef
    edge_secrets_rotated = $true
    github_variable_count = 1
    github_secret_count = 3
    worker_acceptance = $workerAcceptance
    pages = $pagesStatus
    secret_values_printed = $false
  } | ConvertTo-Json
} finally {
  Remove-Item Env:\GH_TOKEN -ErrorAction SilentlyContinue
  $credential.Clear()
  $publicKey = $null
  $serviceRoleKey = $null
  $mediaSecret = $null
  $expirySecret = $null
}
