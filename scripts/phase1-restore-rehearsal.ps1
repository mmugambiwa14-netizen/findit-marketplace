param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [Parameter(Mandatory = $true)]
  [string]$ExpectedSha256,

  [Parameter(Mandatory = $true)]
  [ValidateSet('FINDIT_LOCAL_RESTORE_REHEARSAL')]
  [string]$Confirmation
)

$ErrorActionPreference = 'Stop'
$finditContainer = 'supabase_db_findit'
$finditRehearsalDatabase = 'findit_restore_rehearsal'
$finditContainerDump = '/tmp/findit-phase1-rehearsal.dump'
$finditContainerToc = '/tmp/findit-phase1-rehearsal.toc'
$finditBackupPath = [System.IO.Path]::GetFullPath($BackupFile)
$finditTocPath = "$finditBackupPath.toc"

if (-not [System.IO.File]::Exists($finditBackupPath)) {
  throw "Backup file does not exist: $finditBackupPath"
}

$finditActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $finditBackupPath).Hash.ToLowerInvariant()
if ($finditActualHash -ne $ExpectedSha256.ToLowerInvariant()) {
  throw 'Backup checksum does not match ExpectedSha256'
}

$finditRunningContainer = docker ps --filter "name=^/$finditContainer$" --format '{{.Names}}'
if ($finditRunningContainer -ne $finditContainer) {
  throw "Expected running local container $finditContainer"
}

docker cp $finditBackupPath "${finditContainer}:${finditContainerDump}"
if ($LASTEXITCODE -ne 0) { throw 'Copying the rehearsal backup failed' }

try {
  # The script can only replace this exact disposable local rehearsal database.
  docker exec $finditContainer dropdb --username postgres --if-exists --force $finditRehearsalDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Dropping the disposable rehearsal database failed' }
  docker exec $finditContainer createdb --username postgres $finditRehearsalDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Creating the disposable rehearsal database failed' }

  # The archive relies on these database-level extension prerequisites. They
  # are recreated only in the disposable database; the archive itself contains
  # public application data and auth data, not unrelated Supabase platform data.
  docker exec $finditContainer psql `
    --username postgres `
    --dbname $finditRehearsalDatabase `
    --command 'create schema extensions; create extension pg_trgm with schema public; create extension pgcrypto with schema extensions; do $$ begin execute ''create extension '' || chr(34) || ''uuid-ossp'' || chr(34) || '' with schema extensions''; end $$;'
  if ($LASTEXITCODE -ne 0) { throw 'Preparing the disposable rehearsal database failed' }

  # Every newly-created PostgreSQL database already has `public`. Remove only
  # the archive entry that would create that same default schema, while keeping
  # the rest of the archive in pg_restore's dependency order.
  $finditRestoreToc = docker exec $finditContainer pg_restore --list $finditContainerDump
  if ($LASTEXITCODE -ne 0) { throw 'Reading the restore archive manifest failed' }
  $finditFilteredToc = @($finditRestoreToc | Where-Object { $_ -notmatch ' SCHEMA - public ' })
  $finditUtf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($finditTocPath, [string[]]$finditFilteredToc, $finditUtf8NoBom)
  docker cp $finditTocPath "${finditContainer}:${finditContainerToc}"
  if ($LASTEXITCODE -ne 0) { throw 'Copying the restore archive manifest failed' }

  docker exec $finditContainer pg_restore `
    --username postgres `
    --dbname $finditRehearsalDatabase `
    --no-owner `
    --no-privileges `
    --exit-on-error `
    --use-list $finditContainerToc `
    $finditContainerDump
  if ($LASTEXITCODE -ne 0) { throw 'Restoring the disposable rehearsal database failed' }

  $finditTableCount = docker exec $finditContainer psql `
    --username postgres `
    --dbname $finditRehearsalDatabase `
    --tuples-only `
    --no-align `
    --command "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';"
  if ($LASTEXITCODE -ne 0) { throw 'Verifying restored table count failed' }

  $finditRlsCount = docker exec $finditContainer psql `
    --username postgres `
    --dbname $finditRehearsalDatabase `
    --tuples-only `
    --no-align `
    --command "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;"
  if ($LASTEXITCODE -ne 0) { throw 'Verifying restored RLS count failed' }
}
finally {
  # Cleanup remains constrained to the exact disposable database and container file.
  docker exec $finditContainer dropdb --username postgres --if-exists --force $finditRehearsalDatabase
  docker exec $finditContainer rm -f $finditContainerDump
  docker exec $finditContainer rm -f $finditContainerToc
  Remove-Item -LiteralPath $finditTocPath -Force -ErrorAction SilentlyContinue
}

[pscustomobject]@{
  BackupSha256 = $finditActualHash
  RestoredPublicTables = [int]$finditTableCount
  RestoredRlsTables = [int]$finditRlsCount
  DisposableDatabaseRemoved = $true
} | ConvertTo-Json -Compress
