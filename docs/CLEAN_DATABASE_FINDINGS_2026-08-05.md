# Clean-database findings, 2026-08-05

Two defects were found by building the database from nothing and running the
pgTAP suites. Both are in the migration chain, and both are reproducible with
`npm run test:pgtap-local`.

## 1. The migration chain did not apply from nothing

`20260805074500_database_lint_and_runtime_contract_repairs.sql` required
`private.apply_pending_response_peek_binding()` and failed with:

```
ERROR:  missing function required for Peek alert repair:
        private.apply_pending_response_peek_binding()
```

The chain:

1. `20260805001500` creates `public.apply_pending_response_peek_binding()`, a
   SECURITY DEFINER trigger function.
2. `20260805023000` revokes EXECUTE on it from `public, anon, authenticated`,
   correctly — it is an internal hook, not an RPC.
3. `20260805073000` moves SECURITY DEFINER functions out of `public`, selecting
   on `has_function_privilege('authenticated', ...)`. That is now false for this
   function, so it is skipped and stays in `public`. `bind_response_peek` keeps
   the grant and does move.
4. `20260805074500` pins both to `private` and raises.

Because this is the last migration, `supabase db reset` fails at the end of the
chain, which fails the clean-database gate in `migration-gates.yml` before any
suite runs.

**Fix:** `20260805074500` now resolves each function in either schema
(`coalesce(to_regprocedure('private.' || sig), to_regprocedure('public.' || sig))`)
rather than assuming both moved. This is correct whether or not a given
environment already has the function in `private`.

## 2. No signed-in user could write to their own rows

`0109_seller_contact_reveal_boundary.sql` runs:

```sql
revoke all on schema private from anon, authenticated;
```

with the comment "No USAGE is granted to anon or authenticated -- the SECURITY
DEFINER callers below run as owner." That holds for the reveal helpers it
introduces. It does not hold for the compatibility layer built by `0088`,
`0101` and `20260805073000`, which move SECURITY DEFINER implementations into
`private` and leave **`security invoker`** wrappers in `public`. An invoker
wrapper resolves `private.<fn>` as the calling role, so it needs USAGE.

The contradiction is visible in the catalog: those migrations grant EXECUTE on
**111 of the 115** private functions to `authenticated` (25 to `anon`), which is
only meaningful if those roles can reach the schema.

Observed on a clean database before the fix:

```
public.is_admin()        -> 42501: permission denied for schema private
public.is_active_user()  -> 42501: permission denied for schema private
UPDATE public.listings   -> 42501: permission denied for schema private
UPDATE public.users      -> 42501: permission denied for schema private
```

All 98 public invoker wrappers were unreachable for `anon` and `authenticated`.
The write paths fail because seven trigger functions — `protect_listing_managed_fields`,
`protect_service_managed_fields`, `protect_user_managed_fields`,
`protect_business_profile_managed_fields`, `protect_listing_photo_mutation`,
`protect_alert_fields`, `set_listing_expiry_defaults` — are invoker functions
that call `public.is_admin()`.

RLS policies were unaffected: policy expressions are evaluated with the table
owner's privileges, so reads kept working. Only direct wrapper calls and
trigger-invoked calls failed, which is why this presents as "reads fine, writes
denied".

**Fix:** `20260805090000_restore_private_schema_usage_for_wrappers.sql` grants
USAGE (not CREATE) on `private` to `anon, authenticated`, and asserts both that
USAGE is present and that CREATE is not. This does not widen the API surface:
PostgREST exposes only the schemas in its `db-schemas` setting, so `private`
remains unreachable as an API namespace regardless of USAGE.

**This is a security-boundary change and deserves a second opinion.** The
alternative — making the seven trigger functions SECURITY DEFINER — was
rejected because their guard logic tests `current_user not in ('postgres',
'service_role')`, which SECURITY DEFINER would make true, silently disabling the
managed-field protection they exist to provide.

## Suite results

31 of 46 suites pass on a clean database with the local harness.

The 15 failures **cannot all be attributed from here**. Eight of them
(`v1_security_advisor_baseline`, `v1_recommendation_services`,
`v1_recommendation_related_services`, `v1_recommendation_service_operations`,
`v1_private_country_helper_implementations`, `v1_contact_support`,
`v1_essential_notifications`, `v1_contextual_ecosystem_intelligence`) were
already in the certification list before this work and presumably pass on the
Docker stack, so the harness is the more likely difference. `supabase test db`
remains the authority.

Two failures do look like genuine staleness rather than harness drift:

- `v1_function_privilege_matrix` expects `anon` EXECUTE on
  `public.is_public_marketplace_image`, which `20260805073000` moved to
  `private`, and does not know about 18 functions added since it was written
  (`peek_thread_page`, `record_recommendation_event`,
  `public_response_peek_metadata`, and others). It encodes a boundary from
  before roughly fifteen features landed — consistent with it never having been
  executed.
- `v1_rls_matrix` aborts at line 128 with
  `invalid input syntax for type uuid: "V1-OWNER@EXAMPLE.TEST"`.

Both need a run against the Docker stack to separate stale expectations from
real drift before their expectations are rewritten.

## Harness

`npm run test:pgtap-local` (`scripts/run-local-pgtap.sh`) builds the database on
a plain PostgreSQL 16 with
`supabase/tests/harness/supabase-bootstrap.sql` and runs the suites. It needs no
Docker.

It is authoritative for **whether the migration chain applies from nothing** — a
migration that fails there fails `supabase db reset` too. It is *not*
authoritative for exact privilege boundaries, because PostgreSQL grants EXECUTE
on functions to PUBLIC by default and Supabase does not.

## Update — pgTAP suite triage (Docker stack unavailable)

Attempted the authoritative run on the real Supabase Docker stack. The daemon
starts, but this environment's egress policy returns 403 on the CDN hosts that
serve Docker image layers (`production.cloudfront.docker.com` for Docker Hub,
`*.cloudfront.net` for ECR Public), so no images can be pulled and
`supabase test db` cannot come up. This is an organization policy denial, not a
transient failure — reported, not routed around.

Fell back to the hand-built Postgres 16 harness, which **is** authoritative for
behavioural and migration-set-data assertions (it is not authoritative for exact
anon/authenticated grant sets, because its bootstrap grants browser roles a
default that Supabase does not). Current state: **34 of 48 suites pass**.

### Fixed and verified

- **`v1_rls_matrix.sql` — now 51/51.** Two genuinely stale assertions, both
  proven by migration DDL, not harness quirks:
  1. It called `get_public_seller_profile('…@example.test')`, but migration
     `0090` changed that function from `(seller_email text)` to
     `(p_seller_id uuid)` (an email-enumeration privacy fix). Updated the three
     calls to pass the fixture UUIDs.
  2. Its admin fixture set only `role='admin'`, but migration `0030`'s
     founder-lock model requires `super_admin=true` as well
     (`private.is_admin()` = active + admin + super_admin + (founder-email OR
     `session_user='postgres'`)). In a pgTAP run `session_user` stays `postgres`
     after `SET ROLE`, so adding `super_admin=true` is the correct, sufficient
     fixture fix.

### Confirmed stale, root-caused, left for the Docker run to fix end-to-end

- **The recommendation "disabled by default" cluster** —
  `v1_recommendation_services`, `v1_recommendation_related_services`,
  `v1_recommendation_service_operations`, `v1_contextual_ecosystem_intelligence`.
  All assert services are disabled by default. Migration
  `0100_release_control_consistency.sql` is, by its own comment, "the reviewed
  release-control activation point" — it deliberately enables all seven services
  (0059 creates them disabled; 0100 turns them on and self-validates exactly 7).
  The test expectation predates 0100. Fixing these fully means rewriting each
  suite's disabled-service setup, which should be validated on the real stack.

### Not resolvable on this harness (need the Docker stack)

These fail on the anon/authenticated **grant set**, which the hand-built
bootstrap over-grants relative to Supabase, so the harness cannot judge them:
`database_auth_rls_smoke`, `v1_admin_operations`, `v1_contact_support`,
`v1_listing_creation_and_media`, `v1_function_privilege_matrix`,
`v1_security_advisor_baseline`. `v1_function_privilege_matrix` additionally has
real drift (it lists `is_public_marketplace_image`, which `20260805073000` moved
to `private`, and omits ~18 functions added since), but its exact expected grant
set can only be rewritten against the real stack.

The remaining behavioural failures (`v1_essential_notifications`,
`v1_marketplace_profile_media`, `v1_private_country_helper_implementations`,
`v1_tour_foundation`) are single-assertion and want per-suite review with the
real stack before rewriting.

Net: the exhaustive run was worth doing — it surfaced **two genuinely stale
suites with real, migration-proven drift** (one fixed here, one root-caused),
not just harness noise.
