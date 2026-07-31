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

The guarded maintenance capsule changed only the migration-ledger version after
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
- canonical migration rows: 101
- maximum migration: `0101`
- generated-version residue: zero

## Hosted semantic certification

A disposable transaction exercised representative public wrappers and verified
state before rolling all fixtures back:

- owner-only listing notes matched the direct private implementation;
- another account received zero owner-note rows;
- owner pause and resume transitions completed and preserved the listing;
- notification rows matched the direct private implementation;
- a buyer created a listing conversation;
- the seller replied, marked it seen and loaded the inbox;
- public and private inbox/thread results matched;
- a non-participant was denied thread access;
- the buyer filed a conversation report;
- an admin loaded category/dashboard/recommendation configuration data;
- the admin actioned the report and wrote an audit record;
- null listing submission, unknown-media replacement and unknown-Peek report
  paths preserved their exact fail-closed errors;
- a suspended account was denied message sending.

The transaction observed one conversation, two messages, one actioned report,
one audit record, one notification and one completed owner-transition fixture.
After rollback, all four Auth fixtures, the listing and the notification were
confirmed absent.

## Exact rollback certification

The repository rollback capsule executed inside a non-persisted hosted
transaction and restored:

- 57 authenticated-callable public privileged functions;
- exact catalog fingerprint `ce6194659e01b758dc20948daf351bea`;
- zero target implementations left in `private`.

The transaction was then rolled back. The live staging postcondition was
rechecked and remained:

- zero authenticated-callable public privileged functions;
- 57 public invoker wrappers;
- zero semantic fixture residue.

## Repository certification

The migration is covered by:

- pgTAP wrapper, result/default/planner and grant matrices;
- representative owner, messaging, notification, submission, media, reporting,
  admin and recommendation assertions;
- existing domain suites in the clean-database migration workflow;
- recommendation database workflow coverage;
- source contracts, migration-tip and guarded-ledger contracts.

Conventional GitHub Actions certification remains pending while runner jobs fail
before executable steps begin. Production remains locked at migration `0049`.
