# PeekaListing — action completeness and UI noise

**Audit base:** `main` @ `28540ca`
**Two questions:** does every surface have the actions it needs (your example: logging on the admin side),
and is the app carrying more than it should?

Short answers. **Actions: mostly complete, with three real holes** — a seller can never mark a listing
sold, one admin decision type leaves no trail at all, and the admin audit log shows only part of what
admins do. **Noise: the app itself is not crowded** — one screen is, and the real clutter is inert
scaffolding in the codebase rather than anything a user sees.

---

## Part 1 — Admin actions and logging

### A1. Managed-listing decisions leave no trail — Medium

Of the 23 mutating `admin_*` functions, 22 record what happened somewhere. One does not.

`public.admin_update_managed_listing_request` writes only to `managed_listing_requests`:

```sql
update public.managed_listing_requests
set status = p_status,
    reviewer_message = nullif(trim(p_message), ''),
    assigned_to = coalesce(p_assigned_to, assigned_to),
    updated_at = now()
where id = p_request_id;
```

No `record_admin_action` call, no event row. Nothing records **who** changed the status or **what it was
before**. And because `reviewer_message` is assigned rather than appended, each decision overwrites the
previous reviewer's message — so the reasoning history is destroyed as it goes.

This is a commercial decision about whether the marketplace will list on someone's behalf. It is the one
admin action with no trail of any kind.

**Fix.** Add a `record_admin_action` call, as the other 22 functions already do. If the message history
matters, append to an events table rather than overwriting the column.

### A2. The admin audit log shows only part of admin activity — Medium

`/admin/audit-log` reads `admin_audit_rows_page`, which selects `from public.audit_logs`. Admin activity
is actually recorded in **three** places:

| trail | written by | visible at `/admin/audit-log`? |
|---|---|---|
| `public.audit_logs` | 17 admin functions via `record_admin_action` | **yes** |
| `public.business_review_events` | business application + category reviews | **no** |
| `public.recommendation_configuration_audit` | recommendation config changes | **no** |
| *(nothing)* | managed-listing decisions (A1) | n/a |

`business_review_events` is a proper audit trail — it has `actor_user_id`, a constrained `action` enum
(`application_rejected`, `category_approved`, `category_suspended`, …) and a timestamp. The data is there
and it is good. But **neither `business_review_events` nor `recommendation_configuration_audit` is
referenced anywhere in `src/`**, so neither is readable in the product. Reviewing them needs direct
database access.

The effect: an admin asking "what has been done on this marketplace?" gets an answer that silently omits
every business approval, rejection and category suspension — the decisions most likely to be disputed by
the person on the other end. Nothing on the page indicates the view is partial.

**Fix.** Either union the three sources in `admin_audit_rows_page`, or add tabs to the audit page for
"Moderation", "Business reviews" and "Configuration". The second is less work and reads better.

### A3. The recommendation engine has no admin UI at all — Medium

Seven admin capabilities exist in the database, are granted to `authenticated`, are audited, and have **no
screen anywhere**:

```
admin_upsert_recommendation_relationship
admin_upsert_recommendation_taxonomy_node
admin_upsert_recommendation_weight_profile
admin_upsert_recommendation_context_rule_v1
admin_update_recommendation_service_policy_v1
admin_purge_recommendation_service_cache_v1
admin_recommendation_configuration_snapshot
```

The `/admin` dashboard *displays* recommendation analytics (`AdminRecommendationAnalytics`), so an admin
can see how recommendations are performing — and then has no lever to change anything. Weight profiles,
relationship rules, context rules, service policies and cache purging are all SQL-only.

For a marketplace whose discovery surface is driven by this engine, that is a significant operational gap:
the thing most likely to need tuning after launch is the thing that cannot be tuned from the product.

**Fix.** Even a read-only configuration screen plus the cache-purge button would help. The full editing
surface is a bigger build; `admin_recommendation_configuration_snapshot` already exists to render it.

### A4. Dead admin code — Low

- `setAdminUserRole` exists in `adminService.js` and as `admin_set_user_role` in the database, is audited,
  and has **no UI**. It would also be a no-op: `is_admin()` requires the founder email hash, so a promoted
  user still would not pass. The capability is real at two layers and impossible at the third.
- `getAdminCategories`, `addAdminCategory`, `updateAdminCategory` are the superseded v1 taxonomy path;
  `AdminCategories` uses the v2 service. Three exported functions with no caller.

### A5. Operational actions that do not exist — Low, product judgement

None of these is a defect, but each is the sort of thing that starts to hurt around the first hundred
users:

- **No bulk actions.** Every admin table acts one row at a time. A spam wave means one dialog per listing.
- **No export.** No CSV or data download from any admin surface — users, listings, reports, audit log.
- **No admin-initiated account deletion.** Admins can suspend and ban; only the user can delete. Fine
  until someone sends a deletion request that must be actioned on their behalf.

---

## Part 2 — Member actions

### M1. A listing can never be marked sold — Medium

`listing_status` declares six states:

```sql
create type listing_status as enum ('draft','available','under_offer','sold','rented','expired');
```

**`'sold'` appears exactly once in the entire 40,000-line schema — that declaration.** No function, trigger
or migration ever sets it. `'rented'` appears only as a *source* state in transition guards, never as a
destination.

What an owner can actually do (`owner_transition_listing`): `submit`, `pause`, `resume`, `unavailable`.

So a seller who sells their car marks it **"unavailable"** — the same state as "withdrawn", "temporarily
off", or "changed my mind". The marketplace never learns that a sale happened.

That costs more than tidiness. Sold-count is the usual basis for seller trust signals, it is the honest
answer to "is this still available?" (the exact first message in the demo inbox), and it is the input any
future analytics or ranking on seller performance would need. Adding it later means the historical data
does not exist.

**Fix.** Add a `sold` action to `owner_transition_listing` (and `rented` for rentals, which the enum
already anticipates), and surface it in `MyListings` alongside pause. The enum and the UI status labels
are already in place.

### M2. The Data Protection page contradicts the product — Medium

`src/lib/legalContent.js`, review date **30 July 2026**, states:

> "There is currently no one-click self-service export or account-deletion button. Requests are handled
> manually through support. We will not describe that workflow as automated until it exists."

Self-service account deletion **does** exist: `Settings.jsx:108` renders `DeleteAccountSection`, which
takes a typed `DELETE` confirmation and calls `deleteCurrentAccount` → `prepare_own_account_deletion`.

The sentence is half right — there is still no data export — but it tells users a capability is
unavailable when it is one tap away in Settings, on a page that carries a review date and is the
document a regulator would read first. The last clause ("we will not describe that workflow as automated
until it exists") shows the intent was to stay honest; the copy simply was not revisited when deletion
shipped.

**Fix.** Split the sentence: deletion is self-service in Settings; export is still manual via support.
Then add data export — it is the one member action genuinely missing, and the page already promises
"a copy of information you provided in a portable form".

### M3. Otherwise complete

Verified present, each traced to a real component or RPC: edit and remove listings and services,
pause/resume, block a conversation, report a listing, a conversation and a Peek, retry and remove your own
Peek, email and push notification preferences, change password, MFA enrolment, recommendation
personalisation opt-out, and account deletion. For a marketplace at this stage that is a full set.

---

## Part 3 — Noise

### N1. The app is not crowded. One screen is.

Measured on the signed-in run at 390 px, by rendered text and interactive controls:

| screen | characters | controls |
|---|---|---|
| **/settings** | **3,231** | **21** |
| /admin | 1,315 | 9 |
| /profile | 814 | 1 |
| /post | 615 | 4 |
| /admin/listings | 706 | 18 |

Discover renders six components (header, search, category grid, Peek rail, map view, segmented control).
Search, listing detail and chats are all restrained. **The app reads as clean because it mostly is.**

`/settings` is the outlier at 2.5× the next densest screen, with **seven top-level sections**:

```
Push notifications · Email notifications · Permissions & privacy
Account profile · Account security · Seller profile · Recommendation privacy
```

Four of the seven are notification-or-privacy surfaces, and two are profile editors. A user wanting to turn
off one kind of email has to work out which of four privacy-ish sections owns it.

**Fix — grouping, not deletion.** Two sections would carry all seven: **Notifications** (push, email, and
the recommendation-personalisation toggle) and **Account** (profile, seller profile, security,
permissions). Nothing needs removing; the page needs one level of hierarchy.

`/profile` carries 11 menu items, which with a 5-item bottom nav is a lot of routes to the same places.
That said, no destination is reachable from more than four components, which is normal for an app with a
footer, a nav and a profile menu. Not a problem worth solving.

### N2. The real clutter is in the codebase, not the interface

**16 of 18 disabled feature flags gate no code whatsoever.** No file in `src/` references
`featureFlags.payments`, `.subscriptions`, `.escrow`, `.premiumListings`, `.aiContentModeration`,
`.aiBanEvasionDetection`, `.aiTicketTriage`, `.aiSupportChat`, `.scheduledReminders`, `.marketingEmails`,
`.currencyConversion`, `.phoneVerification`, `.internationalListing`, `.serviceRadius`, `.listingExpiry`
or `.listingFreshnessReminders`. Only `toursPreview` and `previewFixtures` gate anything.

Each of those 16 still costs a declaration in `featureFlags.js`, a line in `.env.example` (16 lines), a
line in the staging workflow (16 lines), and entries in `validate-env.mjs` (20 lines) — roughly 70 lines
of configuration for capabilities that have no implementation to switch on.

**Seven dormant tables have zero client references**: `escrow_transactions`, `legal_practitioners`,
`legal_bookings`, `legal_specializations`, `practitioner_reviews`, `practitioner_payouts`,
`disposable_email_domains` — plus two migrations named for them (`0008_payments_dormant.sql`,
`0028_v1_legal_domain_isolation.sql`).

**Six exported constants are dead**: `ZIMBABWE_LOCATIONS`, `PROVINCES`, `LEGAL_PRACTICE_AREAS`,
`PRACTITIONER_TYPES`, `COLORS`, `LISTING_NUMBER_PREFIXES` — none referenced outside `src/lib/constants.js`.

Add the two from the earlier audits — the abuse rate limiter nothing calls, and the ~150-line OAuth popup
bridge that `noopener` makes unreachable — and the pattern is consistent.

**In fairness**, `featureFlags.js` states the policy explicitly: *"Central switchboard for capabilities
that are disabled-not-deleted."* Keeping the payments schema dormant is a defensible bet. But a flag that
gates nothing is not a disabled capability — it is a name with nothing behind it. The practical cost is
that `.env.example` and the deploy workflow read like the product does escrow, subscriptions, premium
listings and four kinds of AI, which makes it harder for anyone new to see what actually exists.

**Suggested cut**, in order of payoff and safety:

1. Delete the 6 dead constants and the 3 superseded admin category functions. Zero risk.
2. Drop the 16 no-op flags from `featureFlags.js`, `.env.example`, the workflow and `validate-env.mjs`.
   Re-add a flag when the feature it gates is actually being built. Keeps the schema untouched.
3. Leave the dormant tables. They cost nothing at runtime, and `0008_payments_dormant.sql` is an
   intentional, documented decision.

---

## Method and limits

Logging coverage was determined by parsing every migration in order, extracting the latest definition of
each function body, and checking for `record_admin_action` / `write_audit_log` / a direct `audit_logs`
insert — after a first pass that looked only for direct inserts returned a misleading zero. Admin UI
coverage was measured by comparing surviving `EXECUTE` grants against RPC names actually called from
`src/`; five apparent gaps turned out to be a regex artefact and were verified by hand before being
dropped. Density figures come from the authenticated browser run at 390 px.

**Not covered.** Whether the *missing* actions matter is a product judgement, not a technical finding —
I have flagged them with the reasoning rather than asserting they must be built. I did not assess how the
recommendation engine behaves untuned, nor whether bulk moderation is needed at your current volume.
Nothing here was executed against real data, so "no code path sets `sold`" is a claim about the schema and
application source at this commit, not about what may exist in the production database.
