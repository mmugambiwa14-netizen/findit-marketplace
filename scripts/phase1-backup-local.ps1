param(
  [Parameter(Mandatory = $true)]
  [string]$OutputFile
)

$ErrorActionPreference = 'Stop'
$finditContainer = 'supabase_db_findit'
$finditContainerDump = '/tmp/findit-phase1-rehearsal.dump'
$finditOutputPath = [System.IO.Path]::GetFullPath($OutputFile)
$finditOutputDirectory = [System.IO.Path]::GetDirectoryName($finditOutputPath)

if ([System.IO.Path]::GetExtension($finditOutputPath) -ne '.dump') {
  throw 'OutputFile must end with .dump'
}

if (-not [System.IO.Directory]::Exists($finditOutputDirectory)) {
  throw "Output directory does not exist: $finditOutputDirectory"
}

$finditRunningContainer = docker ps --filter "name=^/$finditContainer$" --format '{{.Names}}'
if ($finditRunningContainer -ne $finditContainer) {
  throw "Expected running local container $finditContainer"
}

docker exec $finditContainer pg_dump `
  --username postgres `
  --dbname postgres `
  --format custom `
  --schema public `
  --schema auth `
  --no-owner `
  --no-privileges `
  --file $finditContainerDump

if ($LASTEXITCODE -ne 0) { throw 'Local pg_dump failed' }

docker cp "${finditContainer}:${finditContainerDump}" $finditOutputPath
if ($LASTEXITCODE -ne 0) { throw 'Copying the local backup failed' }

docker exec $finditContainer rm -f $finditContainerDump
if ($LASTEXITCODE -ne 0) { throw 'Removing the temporary container backup failed' }

$finditHash = Get-FileHash -Algorithm SHA256 -LiteralPath $finditOutputPath
[pscustomobject]@{
  Backup = $finditOutputPath
  Sha256 = $finditHash.Hash.ToLowerInvariant()
  Bytes = (Get-Item -LiteralPath $finditOutputPath).Length
} | ConvertTo-Json -Compress
