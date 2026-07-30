# Staging migration-ledger reconciliation — 0095

Date: 2026-07-31 (Europe/Istanbul)

## Scope

This evidence records the staging-only canonicalization and hosted verification of repository migration:

`0095_private_support_request_implementation.sql`

Target project: FindIt Staging (`bwgklpxoetrrkutottdb`)

Production was not queried or changed. The locked production boundary remains migration `0049`.

## Managed apply identity

The managed migration API applied the reviewed SQL successfully but recorded a generated timestamp version.

| Field | Verified value |
| --- | --- |
| Generated version | `20260730230156` |
| Migration name | `private_support_request_implementation` |
| Statement count | 1 |
| Statement MD5 | `a228f7169d9191274b20b15241716abe` |
| Statement length | 8325 |

The repair script `supabase/maintenance/reconcile_staging_migration_history_0095.sql` changes only `supabase_migrations.schema_migrations.version` after locking the ledger and verifying the exact name, statement hash, statement length and expected timestamp-version shape.

It does not recreate, alter, drop or execute application functions, grants, support requests or marketplace data.

## Canonical ledger result

| Check | Hosted result |
| --- | --- |
| Canonical migration rows | 95 |
| First version | `0001` |
| Last version | `0095` |
| Sequence mismatches | 0 |
| Remaining generated versions | 0 |
| Idempotent second execution | Passed |
| Canonical `0095` row preserved | Yes |

## Function boundary result

| Check | Hosted result |
| --- | --- |
| Private volatile `SECURITY DEFINER` implementations | 1 |
| Public volatile `SECURITY INVOKER` wrappers | 1 |
| Default arguments on each identity | 1 |
| `PUBLIC` execute grants | 0 |
| `anon` public-wrapper execution | Preserved |
| `authenticated` public-wrapper execution | Preserved |
| `service_role` public-wrapper execution | Preserved |
| `anon` private-implementation execution | Preserved |

The public RPC signature remains:

`public.submit_support_request(text, text, text, text DEFAULT NULL) -> jsonb`

The privileged implementation is in the non-exposed `private` schema with an empty `search_path`.

## Hosted semantic matrix

The permanent post-migration schema was exercised using rollback-only support requests.

| Semantic check | Result |
| --- | --- |
| Anonymous public-wrapper submission | Passed |
| Anonymous direct private submission | Passed |
| Omitted optional related reference | Passed on both paths |
| Compact `received` confirmation | Passed |
| Opaque reference format | `FIT-YYYYMMDD-XXXXXXXXXX` |
| Public/private references distinct | Yes |
| Guest raw inbox read | Denied |
| Invalid category | Rejected with SQLSTATE `22023` |
| Fourth request within 15 minutes | Rejected with SQLSTATE `P0001` |
| Rate-limit message | Canonical bounded message preserved |
| Residual support rows after rollback | 0 |

The active repository client retains the same four-argument RPC and compact confirmation contract. Provider/database errors are now mapped to bounded plain-language recovery messages and raw provider errors are not attached to user-visible exceptions.

## Security Advisor result

The Supabase Security Advisor no longer reports `public.submit_support_request` as an anonymous-callable `SECURITY DEFINER` function.

The remaining anonymous-callable definer boundaries are:

- `public.record_recommendation_event`
- `public.public_listing_search_page`

Hosted Auth warnings for leaked-password protection and MFA configuration remain separate provider-side release work.

## CI note

GitHub Actions is still failing before runners create executable job steps or logs. The 0095 migration, default argument, grants, privacy and rate-limit semantics were therefore verified directly through fail-closed migration execution and rollback-only hosted transactions. The repository retains both the focused boundary pgTAP matrix and the full contact-support privacy/rate-limit matrix for conventional clean-database CI when runners recover.
