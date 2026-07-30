# Staging Migration Ledger Reconciliation 0091

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration
`0091_private_public_tour_summaries_implementation.sql` was applied to staging
only after the release candidate, migration and recommendation database suites
all passed on branch head `0f5f24724430e99534302989bea214a4230f9b8e`.

The migration preserves the public `public_tour_summaries(uuid[], uuid[])` RPC
signature, result shape, visibility logic and 100-parent input ceilings while
moving its privileged `SECURITY DEFINER` implementation into the non-exposed
`private` schema. The public RPC remains as a locked `SECURITY INVOKER` wrapper.

The hosted migration application completed concurrently and recorded generated
version `20260730201809` instead of the repository's canonical version `0091`.
A subsequent duplicate apply attempt failed closed after detecting the already
created private implementation; it did not create an alternate schema state.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730201809` |
| Name | `private_public_tour_summaries_implementation` |
| Statement count | 1 |
| Statement MD5 | `1ffbe7e117d538c27bb133acd67bd045` |
| Statement length | 8676 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0091.sql`

The script verifies the exact name, statement hash and statement length,
refuses an occupied canonical version or unexpected source version, changes
only the migration ledger version, and executes no function, grant or
application-data statement. It is idempotent after completion.

## Completion evidence

Post-repair verification returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 91 |
| Last version | `0091` |
| Remaining generated versions | 0 |
| Private Peek-summary definers | 1 |
| Public Peek-summary invoker wrappers | 1 |
| `PUBLIC` execute grants | 0 |
| Anonymous null/empty parity | equal, zero rows |
| Listing parent ceiling | 100; 101 rejected with `22023` |
| Service parent ceiling | 100; 101 rejected with `22023` |

The hosted Security Advisor no longer reports `public_tour_summaries` as an
anonymous- or authenticated-executable `SECURITY DEFINER` function, clearing
two targeted warnings.

Production was not queried or changed by this migration or reconciliation and
remains at migration `0049`.
