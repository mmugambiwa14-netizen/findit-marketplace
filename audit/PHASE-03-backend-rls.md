# PHASE 03 — SUPABASE, DATABASE, RLS & RPC SECURITY

**Audited ref:** `origin/main` @ `ee6f212` · **Evidence:** Static replay of 159 migrations PASS · Live DB BLOCKED E-004

> Method: policy state was **reconstructed by replaying every `create policy` / `drop policy` statement in
> migration order**, not by reading the first migration that defines a table. Early permissive policies that
> were later dropped are therefore not reported as live. Full table in `rls-matrix.csv`.

---

## 3.1 Headline — the RLS and RPC layer is the strongest part of this codebase

| Control | Result |
|---|---|
| Tables with RLS enabled | **97 / 99** in `public` |
| Tables without RLS | 2, both in the **`private`** schema, which `supabase/config.toml:13` does **not** expose (`schemas = ["public","graphql_public"]`) |
| Final live policies | **118** |
| Surviving `using (true)` policies | **3**, all public reference data |
| `SECURITY DEFINER` functions | **165** |
| …**without a pinned `search_path`** | **0** |
| Tables that are RLS-on with zero policies (deny-all) | **36** |

No P0 was found in this phase.

## 3.2 `using (true)` policies — all three are legitimate reference data

| Table | Policy | Assessment |
|---|---|---|
| `country_configs` | `country_configs_public_read` | Public country/currency configuration. Appropriate. |
| `exchange_rates` | `exchange_rates_public_read` | Public rate reference. Appropriate. |
| `marketplace_operational_controls` | `marketplace_operational_controls_public_read` | Columns: `control_key`, `enabled`, `state`, `configuration jsonb`, `updated_at`, `updated_by`. **`configuration` and `updated_by` are world-readable** — the jsonb may hold internal thresholds and `updated_by` exposes an admin user UUID. → **F-025 (P3)** |

Earlier permissive policies were **correctly retired**: `business_profiles_public_read`,
`reviews_public_read` and `seller_ratings_public_read` (`0011:202,205,216`) were all dropped by
`0013_v1_rls_hardening.sql:274-276` and successors. `reviews`, `seller_ratings` and `follows` are now
**admin-SELECT-only**.

## 3.3 `WITH CHECK` omissions — assessed and dismissed

Six write policies omit `with check`: `admin_teams_admin_only`, `email_templates_admin_only`,
`locations_admin_update`, and the three `*_details_owner_update` policies.

**This is not a vulnerability.** PostgreSQL applies the `USING` expression as the `WITH CHECK` expression
when the latter is absent. The admin policies gate on `public.is_admin()`, which is row-content
independent; the detail policies gate on an `exists (…)` ownership test against the parent listing, which
correctly re-evaluates against the new row and so blocks re-parenting a detail row onto a listing the
caller does not own. Recorded as a style observation only — **no finding**.

## 3.4 Seller contact boundary — fully traced and PASS

This was the highest-risk hypothesis in the audit and it is **correctly closed**. The grant history on
`public.listings` in order:

| Migration | Statement | Effect |
|---|---|---|
| `0021:593` | `revoke insert on table public.listings from anon, authenticated` | no direct inserts |
| `0048:3` | `grant select on table public.listings to anon, authenticated` | **table-level** grant — would have made column-level revokes ineffective |
| **`0049:252`** | **`revoke select on table public.listings from anon, authenticated`** | **removes the table-level grant** |
| `0049:253-287` | `grant select (…35 named columns…)` | replaces it with an explicit **column allowlist** |
| `0109:49,52` | `revoke select (contact_phone, contact_whatsapp, contact_email) … from anon` | column-level revoke against a column-level grant — effective |
| `0115:184,187` | same revoke **from `authenticated`** | closes the residual |

The ordering matters: a column-level `REVOKE` cannot override a table-level `GRANT` in PostgreSQL, so had
`0049:252` been absent, `0109` and `0115` would have been **no-ops** and every seller's phone, WhatsApp and
email would be readable by `anon`. The table-level grant is revoked first, so the boundary holds.

`0115`'s header documents the staging reproduction that motivated it — *"acting as an ordinary authenticated
user with no relationship to the seller: `select count(contact_phone) from public.listings where seller_id = <other user>` → 2"* —
and it also fixes owners consuming their own reveal budget. **Recorded as a significant strength.**

Appendix C: **"Public projections exclude private contacts" = PASS** (repo-certified; hosted confirmation E-004).

## 3.5 Location privacy — PASS

Correctly architected against the brief's "exact occupied-property coordinates create safety/privacy risk":

- Public allowlist (`0049:253-287`) grants `public_latitude`, `public_longitude`, `public_location_label`, `location_visibility` — **raw `listings.latitude` / `longitude` are NOT granted**.
- Exact data is isolated in a separate table `listing_private_locations` (`exact_latitude`, `exact_longitude`, `exact_address`, `accuracy_meters`, `provider_place_id`) whose policies are:

| Policy | Rule |
|---|---|
| `listing_private_locations_owner_admin_read` | `owner_id = auth.uid() or public.is_admin()` |
| `listing_private_locations_server_insert/update/delete` | `current_user = any(array['postgres','service_role']) or is_admin()` |

The separate `locations` allowlist does include `latitude`/`longitude`, but those are **place-registry
centroids** (city/suburb reference points), not property addresses — appropriate.

## 3.6 Out-of-MVP tables — deny-all, not live attack surface

36 tables are RLS-enabled with **zero policies**, which under RLS means deny-all for `anon` and
`authenticated`; all access must go through `SECURITY DEFINER` RPCs or the service role. This includes
every monetisation and out-of-scope table:

`payments`, `escrow_transactions`, `subscriptions`, `practitioner_payouts`, `legal_practitioners`,
`legal_specializations`, `legal_bookings`, `practitioner_reviews` — plus `reviews`, `seller_ratings` and
`follows` at admin-SELECT-only.

**F-023 is downgraded from P2 to P3** on this evidence: these are schema debt and reviewer-confusion risk,
**not** reachable attack surface. The same deny-all posture correctly covers operational internals
(`listing_upload_intents`, `peek_response_binding_intents`, `recommendation_*`, `web_push_delivery_jobs`,
`tour_asset_cleanup_queue`).

## 3.7 `SECURITY DEFINER` hygiene — PASS

**165 functions, 0 with an unpinned `search_path`.** Distribution: `''` (54 — strictest, forces fully
qualified names), `public` (96), `public, pg_temp` and variants (13), `pg_catalog, …` (2).

Grant hygiene follows a consistent, correct pattern throughout — `revoke all on function … from public, anon;`
then `grant execute … to authenticated;`. 41 grants extend EXECUTE to `anon`, and every one inspected is a
read-only predicate or public projection helper (`is_active_user`, `is_admin`, `is_country_browsable`,
`is_supported_listing_currency`, `discover_category_counts`, `get_public_seller_profile`,
`get_marketplace_location_hierarchy`, `public_business_profiles`, `can_read_listing_context`). No mutating
function is granted to `anon`.

Appendix C: **"Security-definer functions have safe search_path/grants" = PASS.**

## 3.8 Peek Request lifecycle — MVP boundary holds, with a latent hazard

`peek_requests.moderation_status text not null default 'pending'` (`0116_peek_threads_foundation.sql:96`),
and the public read policy requires `moderation_status = 'approved'`. That combination *would* impose a
human approval step — an MVP violation — so the write path was traced:

| Migration | Inserted value | Effect |
|---|---|---|
| `0119_peek_thread_write_api.sql:99` | `'pending'` | would have required human approval |
| `20260804190400_restore_peek_request_rpc_contract.sql:55` | `'approved'` | auto-approve |
| **`20260804191200_allow_peek_request_alert_events_and_fix_count.sql:41`** (current) | **`'approved'`** | **auto-approve — MVP-compliant** |

So Peek Requests publish automatically and `moderation_status` is now vestigial vocabulary.
Appendix C: **"No human approval required" = PASS.**

**Latent hazard:** the column *default* remains `'pending'` while the contract requires `'approved'`. Any
other insert path — a future RPC, an admin tool, a service-role backfill — that omits the column creates a
request that is invisible to the public policy **and** unacceptable by `accept_peek_request`, which requires
`moderation_status = 'approved'` (`20260807020000:24`). The request would silently strand.
→ **F-026 (P2)**

## 3.9 Peek fulfilment authorization — PASS

`accept_peek_request` (`20260807020000_peek_request_fulfilment_lifecycle.sql`) enforces, in order:

1. `is_active_user()` → `42501`
2. request must exist → `P0002`
3. **`private.peek_request_parent_owner(v_request)` must equal `auth.uid()`** → *"Only the listing owner can accept this Peek Request"* `42501` — this is the control that defeats the wrong-seller-fulfilment attack named in the audit brief
4. request must be `status='pending'` and `moderation_status='approved'` → `22023`
5. existing fulfilment in `accepted|uploading|processing` → rejected (no concurrent attempts)
6. already `completed` → rejected
7. **retry limit** → *"Peek Request fulfilment retry limit reached"* — bounded retries
8. inserts with `expires_at = now() + interval '48 hours'` — bounded expiry

`peek_request_fulfilments` has exactly **one** policy (`SELECT`, `owner_id = auth.uid() or is_admin()`), so
all writes are RLS-denied and must pass through this RPC. `listing_tours` follows the same pattern.
This is the correct shape for an authoritative write boundary.

Request creation (`20260804191200:36-45`) additionally enforces: owner cannot request against their own
listing; a 10-minute per-category duplicate window; and an idempotent owner notification
(`on conflict do nothing`).

**Observed for Phase 5:** the seller's "New Peek Request" notification deep-links to `/peek-requests`
(`20260804191200:44`), which routes to `BuyerPeekRequests` (`App.jsx:191`) — the **buyer**-side page.
Whether sellers land on a useful destination is traced in FLOW-09.

## 3.10 Phase 3 findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-025 | P3 | CONFIRMED | `marketplace_operational_controls` is world-readable including its `configuration` jsonb and `updated_by` admin UUID |
| F-026 | P2 | CONFIRMED | `peek_requests.moderation_status` defaults to `'pending'` while the live contract requires `'approved'`; any insert path omitting it strands the request invisibly |
| F-023 | P3 | CONFIRMED | *(downgraded from P2)* out-of-MVP tables are deny-all, so they are schema debt rather than reachable attack surface |

**No P0 identified in Phase 3.**

## 3.11 Strengths recorded

- 97/99 public tables RLS-enabled; the 2 exceptions are in an unexposed schema.
- 165/165 `SECURITY DEFINER` functions pin `search_path`.
- Consistent `revoke all from public, anon` → `grant execute to authenticated` discipline; no mutating function reachable by `anon`.
- Table-level grant deliberately revoked and replaced by a 35-column allowlist, which is what makes the later column-level contact revokes effective.
- Exact coordinates isolated in a separate owner/service-only table.
- Dormant out-of-scope tables left deny-all rather than partially permissioned.
- Write paths for Peeks, fulfilments and listings are RLS-denied and forced through audited RPCs with ownership predicates, row locks, bounded retries and explicit SQLSTATEs.
