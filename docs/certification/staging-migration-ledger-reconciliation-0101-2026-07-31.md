# Staging Migration Ledger Reconciliation 0101

Date: 2026-07-31  
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)  
Production: not queried or changed

## Repository migration

- Canonical version: `0101`
- File: `supabase/migrations/0101_private_authenticated_rpc_implementations.sql`
- Name: `private_authenticated_rpc_implementations`
- Rollback: `supabase/rollback/0101_private_authenticated_rpc_implementations.rollback.sql`

## Catalog boundary

The migration fingerprints the exact pre-migration catalog:

- authenticated-callable public privileged functions: 57
- distinct function names: 57
- catalog fingerprint: `ce6194659e01b758dc20948daf351bea`
- anonymous-callable targets: zero
- unsupported languages: zero
- detected self-referential target bodies: zero

Every implementation is moved to `private` without recreating its body, so its
OID-dependent database relationships, source, defaults, owner, grants and
configuration remain intact. A public SQL `SECURITY INVOKER` wrapper preserves
each existing RPC name, signature, default, result shape and execution-planner
attributes.

## Hosted application

Supabase applied the migration under generated version `20260731021100`.
The stored migration identity was verified before canonical reconciliation:

- statement MD5: `498fd459be12f8a1c6c0174d25b09864`
- statement length: `10105`
- matching rows: exactly one
- canonical `0101` rows before repair: zero

The guarded maintenance capsule changes only the migration-ledger version after
locking `supabase_migrations.schema_migrations` and verifying all identity
fields.

## Structural postconditions

- authenticated-callable public `SECURITY DEFINER` functions: zero
- public invoker compatibility wrappers: 57
- private privileged implementations: 57
- authenticated wrapper and implementation grants: 57
- service-role wrapper and implementation grants: 53
- authenticated-only recommendation admin functions: 4
- anonymous execute grants: zero
- `PUBLIC` execute grants on wrappers: zero

## Certification expectations

The migration is covered by:

- rollback-only hosted structural execution
- exact rollback capsule execution inside a non-persisted transaction
- pgTAP wrapper, grant and representative-domain matrix
- existing owner, messaging, notifications, listing submission, media,
  reporting, admin, support, Peek and recommendation domain suites
- source contracts and both clean-database workflows

Conventional GitHub Actions certification remains pending while runner jobs fail
before executable steps begin. Production remains locked at migration `0049`.
