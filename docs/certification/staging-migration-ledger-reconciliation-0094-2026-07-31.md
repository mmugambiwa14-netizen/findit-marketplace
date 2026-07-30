# Staging migration-ledger reconciliation — 0094

Date: 2026-07-31 (Europe/Istanbul)

## Scope

This evidence records the staging-only canonicalization and hosted verification of repository migration:

`0094_private_recommended_service_event_implementation.sql`

Target project: FindIt Staging (`bwgklpxoetrrkutottdb`)

Production was not queried or changed by this reconciliation. The locked production boundary remains migration `0049`.

## Managed apply identity

The managed migration API applied the reviewed SQL successfully but recorded a generated timestamp version.

| Field | Verified value |
| --- | --- |
| Generated version | `20260730210406` |
| Migration name | `private_recommended_service_event_implementation` |
| Statement count | 1 |
| Statement MD5 | `535f74f6fc17c6ae54696e13246307e0` |
| Statement length | 9274 |

The repair script `supabase/maintenance/reconcile_staging_migration_history_0094.sql` changes only `supabase_migrations.schema_migrations.version` after locking the ledger and verifying the exact name, statement hash, statement length and expected timestamp-version shape.

It does not recreate, alter, drop or execute application functions, grants, recommendation events, services, listings or other marketplace data.

## Canonical ledger result

| Check | Hosted result |
| --- | --- |
| Canonical migration rows | 94 |
| First version | `0001` |
| Last version | `0094` |
| Sequence mismatches | 0 |
| Remaining generated versions | 0 |
| Idempotent second execution | Passed |
| Canonical `0094` row preserved | Yes |

## Function boundary result

| Check | Hosted result |
| --- | --- |
| Private volatile `SECURITY DEFINER` implementations | 1 |
| Public volatile `SECURITY INVOKER` wrappers | 1 |
| `PUBLIC` execute grants | 0 |
| `anon` public-wrapper execution | Preserved |
| `authenticated` public-wrapper execution | Preserved |
| `service_role` public-wrapper execution | Preserved |
| `anon` private-implementation execution | Preserved |

The public RPC signature remains:

`public.record_recommended_service_event_v1(text, uuid, uuid, uuid, text, text, jsonb) -> uuid`

The privileged implementation is now in the non-exposed `private` schema with an empty `search_path`.

## Hosted semantic matrix

The permanent post-migration schema was exercised with rollback-only fixtures.

| Semantic check | Result |
| --- | --- |
| Anonymous public-wrapper event | Passed |
| Anonymous direct private event | Passed |
| Returned event identifiers | Non-null and distinct |
| Stored event count | 2 aggregate-safe rows |
| Recommendation service | `related-services-service` |
| Reason code | `CATEGORY_RELATED_SERVICE` |
| Provider attribution | Correct active service provider |
| Listing subject | Null for service-only attribution |
| Required analytics context | Preserved |
| Unsafe context fields | 0 |
| Paused service target | Rejected with SQLSTATE `22023` |
| Rejection message | `service is not publicly available` |
| Anonymous raw-event table read | Denied |
| Residual service fixtures after rollback | 0 |
| Residual recommendation events after rollback | 0 |
| Residual location fixtures after rollback | 0 |

The allowed event context remained bounded to aggregate analytics fields. The validation explicitly rejected or excluded email, phone, IP address, user-agent, fingerprint and precise-location fields.

## Security Advisor result

The Supabase Security Advisor no longer reports `public.record_recommended_service_event_v1` as an anonymous-callable `SECURITY DEFINER` function.

The remaining anonymous-callable definer findings are separate boundaries:

- `public.public_listing_search_page`
- `public.record_recommendation_event`
- `public.submit_support_request`

Hosted Auth warnings for leaked-password protection and MFA configuration also remain separate provider-side release work.

## CI note

GitHub Actions attempts for this boundary were unable to start runners and returned no job steps or logs. The 0094 migration and semantics were therefore validated directly on staging through fail-closed migration execution and rollback-only hosted transactions. The repository retains the clean-database pgTAP matrix so conventional CI can certify the same boundary when GitHub runners become available.
