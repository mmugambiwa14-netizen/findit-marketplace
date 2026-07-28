# Database and RLS Audit

Local assets only. No remote Supabase project was contacted, linked or queried.
Findings derive from static analysis of `supabase/migrations/*.sql` (44 files),
`supabase/rollback/` (15), `supabase/tests/` (12) and `supabase/config.toml`.

## Headline result

| Measure | Result |
|---|---|
| Tables created | 59 |
| Tables with `enable row level security` | **59 / 59** |
| Tables with user data lacking RLS | **0** |
| `SECURITY DEFINER` functions | 116 |
| …without `set search_path` | **0 / 116** |
| Indexes | 125 across 49 tables |
| `DROP TABLE` statements | **0** |
| Migration sequence | 44 contiguous, `0001`–`0044` |
| Rollback capsules | 15, covering `0030`–`0044` |

The two findings that most commonly sink a Supabase project — a table with RLS
off, and a `SECURITY DEFINER` function without a pinned `search_path` — are both
**clean**. This is the strongest part of the codebase.

## Migration ordering and safety

`verify:sql-boundary` passes: 44 contiguous migrations, no gaps, no duplicate
prefixes, no conflicting redefinitions left un-superseded.

Destructive-statement scan:

- `DROP TABLE`: none.
- `DROP POLICY`: present, always as `drop policy if exists` immediately followed
  by a `create policy` replacement in the same migration (e.g. `0013`, `0018`
  each re-cut the `inquiries` policies). This is intentional policy evolution,
  not data loss.
- `DELETE FROM`: confined to rollback capsules and to `storage.buckets`
  cleanup within them.
- Bucket inserts use `on conflict (id) do update`, so re-running is safe.

**Suitability for a blank Supabase project: good.** All five storage buckets are
created by migrations (`0021`, `0022`, `0032`, `0033`), not only by
`config.toml`. A fresh project provisioned by `supabase db push` therefore gets
its buckets, policies, functions and enums without manual dashboard steps.

**Suitability for staging → production promotion: good, with one caveat.**
Rollback coverage begins at `0030`; migrations `0001`–`0029` have no capsules.
For a fresh project that is irrelevant — but once a database holds production
data, an unwound early migration has no scripted reverse. Recorded as R-07.

## RLS posture

### Policy-bearing tables

50 of 59 tables carry explicit policies. Ownership is expressed as
`auth.uid()`-based predicates, and moderation/admin access flows through
`is_admin()` rather than a client-supplied role claim.

Spot-checked ownership boundaries:

- **Listings** — owner-scoped write, public read restricted by status.
- **Favourites** (`saved_listings`) — user-scoped both directions.
- **Chat** (`conversations`, `inquiries`) — participant-scoped. `0018` replaced
  the earlier policies with `inquiries_participant_read`, and adds
  `conversations_distinct_participants` plus a unique
  `(listing_id, buyer_id)` constraint, so a user cannot open parallel threads
  against the same listing or converse with themselves.
- **Notifications** — recipient-scoped.
- **Reports / moderation** — reporter sees own; admin sees all via `is_admin()`.
- **Tours** — owner + admin read (`listing_tours_owner_admin_read`,
  `listing_tour_slots_owner_admin_read`, `listing_tour_events_owner_admin_read`,
  `listing_tour_upload_intents_owner_admin_read`); public visibility is not a
  table policy at all but is mediated by service-only RPCs.

**No policy was found that relies on a frontend check.** Every user-reachable
mutation path passes through either an RLS predicate or a `SECURITY DEFINER`
function that performs its own authorization.

### Deny-by-default tables (9)

These have RLS enabled and **zero** policies:

```
essential_notification_fanout_jobs   operational_alerts
listing_upload_intents               operational_metric_buckets
marketplace_feature_controls         support_requests
marketplace_image_upload_intents     tour_asset_cleanup_queue
tour_cache_invalidations
```

In Postgres, RLS enabled with no policy denies all access to non-owner roles.
Verified additionally that **none of the nine carries a `GRANT` to `anon` or
`authenticated`** — so they are unreachable from the browser by two independent
mechanisms. They are queue, intent and telemetry tables written by service-role
Edge Functions and read through `SECURITY DEFINER` RPCs.

This is correct and deliberate, not an oversight. `support_requests` deserves a
note: users submit support requests but cannot read the table directly; retrieval
is mediated. That is a defensible design, worth confirming against product
intent rather than changing.

### `FORCE ROW LEVEL SECURITY`

Not used (0 occurrences). Table-owning roles therefore bypass RLS. Under
standard Supabase operation this is expected — `service_role` is *intended* to
bypass, and `postgres` is not exposed to clients. Informational only; adding
`force` would break the Edge Function workers.

## Admin authorization

`0016_v1_admin_operations.sql` establishes the pattern, and it is genuinely
sound:

```sql
create or replace function public.admin_moderate_marketplace_item(...)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
```

`require_admin_reason()` raises `42501` unless `is_admin()`, and because the
call sits in the `declare` block it is evaluated during variable initialisation —
**before any statement in the function body runs**. There is no ordering by
which a non-admin reaches the mutation. The same helper also enforces a 3–1000
character reason, so every privileged action is justified and auditable.

Functions are `revoke all … from public` then `grant execute … to authenticated`,
with `0027_v1_function_execute_hardening.sql` additionally revoking from `anon`.
Granting to `authenticated` is safe precisely because the guard is inside.

Every admin mutation calls `record_admin_action()`, writing `audit_logs` with
before/after JSONB snapshots and a correlation UUID.

## Storage

| Bucket | Public | Size limit | MIME allow-list | Created by |
|---|---|---|---|---|
| `listing-images` | **false** | 5 MiB | jpeg, png, webp | `0021` |
| `marketplace-images` | **false** | 5 MiB | jpeg, png, webp | `0022` |
| `tour-sources` | **false** | 250 MB | mp4, quicktime, webm | `0032` |
| `tour-playback` | **false** | 250 MB | mp4 | `0033` |
| `tour-thumbnails` | **false** | 5 MiB | webp | `0033` |

All private, all constrained on both size and content type. `0033` re-asserts
`public = false` in its `on conflict` clause, so a bucket cannot drift public
through a re-run. 9 `storage.objects` policies enforce owner-scoped paths;
`tour_source_authorized_insert` gates uploads against a validated intent row
rather than trusting the client path.

Reads are served by signed URLs with bounded lifetimes
(`signedPlaybackLifetimeSeconds: 300`, `signedUploadLifetimeSeconds: 1800`,
`signedCardAssetLifetimeSeconds: 3600`).

## Indexes

125 indexes over 49 tables. Coverage of the queries that matter at scale:

| Concern | Index evidence |
|---|---|
| Listing feed / filters | `listings` — 17 indexes |
| Chat threads | `idx_inquiries_conversation (conversation_id, created_at)` |
| Inbox ordering | `conversations_buyer_inbox` and `conversations_seller_inbox`, both `(user, last_message_at desc, id desc)` — matching keyset cursors exactly |
| Tour feed | `listing_tours` — 7 indexes |
| Moderation queue | `reports` — 6; `audit_logs` — 4 |
| Favourites | `saved_listings` — 3 |
| Fanout queue | `essential_notification_fanout_jobs` — 3 |
| Cleanup queues | `tour_asset_cleanup_queue` — 2 |

The inbox indexes are ordered to match the keyset pagination cursors used in
`src/services/keysetPagination.js`, which is the detail most projects miss.

10 of 59 tables carry no index beyond their primary key; all are low-cardinality
configuration or lookup tables where that is appropriate.

**No missing index was identified for feeds, chats, search, foreign keys,
chronological ordering or moderation queues.**

## Triggers, functions, enums

- `set_updated_at()` applied consistently via `trg_*_updated_at`.
- Tour state transitions are driven by RPCs with explicit status validation
  rather than by triggers, keeping the state machine in one readable place.
- `0001_extensions_and_enums.sql` front-loads extensions and enums, so later
  migrations have no ordering hazard against type creation.
- `0012_capture_phone_on_signup.sql` hooks signup metadata capture.

## Findings

**D-01 (Informational)** — `inquiries` carries an `attachments jsonb` column
while `0018` documents V1 as having no attachments. Mitigated by the
`inquiries_v1_no_attachments` CHECK constraint, so it cannot be populated.
Dormant-by-design rather than a defect. *Blocks: nothing.*

**D-02 (Informational)** — the message table is named `inquiries` and the thread
header `conversations`. Correct and FK-linked, but a naming mismatch that will
mislead new contributors. Recommend a schema comment, not a rename.
*Blocks: nothing.*

**D-03 (Low)** — rollback capsules exist only for `0030`–`0044`. Acceptable for
a fresh project; a gap once production data exists. Recommend capsules for any
migration that will run against a populated database.
*Blocks: GitHub no, fresh Supabase no, staging no, production no (operational risk only).*

**D-04 (Informational)** — `supabase/config.toml` pins `site_url` to a GitHub
Pages URL and embeds a Google OAuth **client id**. Client ids are public by
design and are not a secret. The hardcoded staging URL should nevertheless become
environment-driven before production. *Blocks: production yes (configuration).*

## Conclusion

The schema is safe to apply to a **fresh Supabase development project**. It is
self-provisioning, non-destructive, re-runnable, and its authorization model is
enforced in the database rather than the client.
