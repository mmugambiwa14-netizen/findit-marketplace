#!/usr/bin/env bash
#
# Run the pgTAP suites against a plain PostgreSQL 16 instance, without Docker.
#
# `supabase test db` needs the Docker-based local stack. Where Docker is not
# available -- CI containers, restricted sandboxes, a laptop without Docker
# Desktop -- this builds an equivalent database directly: it creates the
# Supabase-shaped roles and schemas from
# supabase/tests/harness/supabase-bootstrap.sql, applies every migration in
# order, then runs the suites.
#
#   ./scripts/run-local-pgtap.sh                  # every suite
#   ./scripts/run-local-pgtap.sh v1_rls_matrix    # substring filter
#
# IMPORTANT -- this is an approximation, not a replacement for the Docker stack.
# The bootstrap reproduces the platform objects the migrations touch, but not
# every Supabase platform default. Privilege-boundary suites in particular
# (v1_security_advisor_baseline, v1_function_privilege_matrix) compare against
# exact grant sets and can fail here while passing on the real stack, because
# PostgreSQL grants EXECUTE on functions to PUBLIC by default and Supabase does
# not. Treat a failure here as a lead to investigate, and
# `run-migration-database-certification.sh` as the authority.
#
# What it IS authoritative for: whether the migration chain applies cleanly from
# nothing. A migration that fails here fails `supabase db reset` too.

set -uo pipefail

PG_VERSION="${PG_VERSION:-16}"
DB_NAME="${DB_NAME:-findit_pgtap}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILTER="${1:-}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install postgresql-${PG_VERSION} and postgresql-${PG_VERSION}-pgtap." >&2
  exit 2
fi

for ext in pgtap postgis; do
  if [ ! -f "/usr/share/postgresql/${PG_VERSION}/extension/${ext}.control" ]; then
    echo "Missing extension '${ext}'. Install postgresql-${PG_VERSION}-${ext//postgis/postgis-3}." >&2
    exit 2
  fi
done

pg_isready -q || pg_ctlcluster "$PG_VERSION" main start || true
pg_isready -q || { echo "PostgreSQL is not accepting connections." >&2; exit 2; }

# postgres needs to read these; the repo checkout may not be world-readable.
cp -r "$ROOT/supabase/migrations" "$WORK/migrations"
cp -r "$ROOT/supabase/tests" "$WORK/tests"
cp "$ROOT/supabase/tests/harness/supabase-bootstrap.sql" "$WORK/bootstrap.sql"
chmod -R a+rX "$WORK"

as_postgres() { su postgres -c "$1"; }

echo "Building $DB_NAME from ${PG_VERSION}..."
as_postgres "psql -q -d postgres -c 'drop database if exists $DB_NAME'" >/dev/null 2>&1
as_postgres "createdb $DB_NAME" || exit 2
# Supabase puts the extensions schema on the database search_path; gin_trgm_ops
# and the PostGIS operators are unqualified in the migrations.
as_postgres "psql -q -d postgres -c \"alter database $DB_NAME set search_path to '\\\$user', public, extensions\"" >/dev/null
as_postgres "psql -v ON_ERROR_STOP=1 -q -d $DB_NAME -f $WORK/bootstrap.sql" >/dev/null || {
  echo "Bootstrap failed." >&2; exit 1; }

echo "Applying migrations..."
migration_failures=0
for f in "$WORK"/migrations/*.sql; do
  # Supabase applies each migration in one transaction; several rely on
  # `create temporary table ... on commit drop` living for the whole file.
  if ! out=$(as_postgres "psql -v ON_ERROR_STOP=1 --single-transaction -q -d $DB_NAME -f $f" 2>&1); then
    migration_failures=$((migration_failures + 1))
    echo "  MIGRATION FAILED: $(basename "$f")"
    echo "$out" | grep -E "ERROR" | head -2 | sed 's/^/      /'
  fi
done

if [ "$migration_failures" -ne 0 ]; then
  echo ""
  echo "$migration_failures migration(s) failed. The chain does not apply from nothing;"
  echo "supabase db reset would fail the same way. Fix these before reading suite results."
  exit 1
fi
echo "  all $(ls "$WORK"/migrations/*.sql | wc -l) migrations applied"

echo ""
echo "Running suites..."
pass=0; fail=0; failed=""
for f in "$WORK"/tests/*.sql; do
  name="$(basename "$f")"
  [ -n "$FILTER" ] && [[ "$name" != *"$FILTER"* ]] && continue
  # -tA emits raw pgTAP lines rather than a formatted table.
  out=$(as_postgres "psql -X -tA -q -d $DB_NAME -f $f" 2>&1)
  nok=$(echo "$out" | grep -cE "^not ok")
  ok=$(echo "$out" | grep -cE "^ok ")
  err=$(echo "$out" | grep -cE "^psql:.*ERROR")
  if [ "$nok" -eq 0 ] && [ "$err" -eq 0 ] && [ "$ok" -gt 0 ]; then
    printf "  PASS  %-58s %s assertions\n" "$name" "$ok"
    pass=$((pass + 1))
  else
    printf "  FAIL  %-58s ok=%s not-ok=%s errors=%s\n" "$name" "$ok" "$nok" "$err"
    echo "$out" | grep -E "^not ok|^psql:.*ERROR" | head -3 | sed 's/^/          /'
    fail=$((fail + 1)); failed="$failed $name"
  fi
done

echo ""
echo "Suites passed: $pass   failed: $fail"
[ -n "$failed" ] && echo "Failed:$failed"
[ "$fail" -eq 0 ]
