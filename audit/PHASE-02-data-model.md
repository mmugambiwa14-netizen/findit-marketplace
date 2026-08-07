# PHASE 02 — DATA MODEL, TAXONOMY & ATTRIBUTES

**Audited ref:** `origin/main` @ `ee6f212` · **Evidence:** Static (159 migrations) ✅ · Live DB ⛔ E-004

---

## 2.1 HEADLINE — the category attribute registry is dead code and `listings.attributes` is never written

`src/domain/listingSchema/` is a versioned, well-documented schema registry across five modules
(`registry.js`, `defineField.js`, `categories/property.js` 381 LOC, `machinery.js` 303 LOC, `vehicle.js`,
`service.js`). Its own docstring states the anti-drift intent (`registry.js:8-17`):

> *"One registry drives creation, editing, draft recovery, review, cards, detail pages, filters and
> moderation. A field cannot exist in the posting form but be absent from search, because both read the
> same definitions."*

**None of that is wired up.**

| Link in the chain | Status |
|---|---|
| `src/domain/listingSchema/registry.js` | imported by exactly **one** file |
| `src/services/listingAttributes.js:6` | the only importer — and it is imported by **nothing** |
| `listings.attributes` / `services.attributes` jsonb columns (`0114:30,32`) | **never written** by any migration or client path |
| `create_v1_listing_submission` (`0046`) | `attributes` is **absent from the INSERT column list** |
| `listingCreationRepository.js:27-32` | sends only `p_submission_key`, `p_listing`, `p_detail`, `p_media` |

*Verification note:* `src/components/listings/ListingCard.jsx:32` defines a **local** function named
`listingAttributes(listing, type)` — it is not an import of the service, and does not connect the registry.

Consequently `listings.attributes` and `services.attributes` permanently hold their default
`{"version": 1, "values": {}}`, and the CHECK constraint `listings_attributes_shape`
(`0114:63-66`) validates a document that is always empty.

→ **F-019 (P2)** dead registry · **F-020 (P2)** attribute columns never populated

## 2.2 The real attribute surface is the three detail tables — and it is thin

What is actually captured, validated and stored:

| Vertical | Table | Columns | Server constraints |
|---|---|---|---|
| Property | `property_details` | `property_type`, `bedrooms`, `bathrooms`, `size_sqm` | `property_details_counts_nonnegative` (`0013:171`), `property_details_size_positive` (`0013:173`) |
| Cars | `car_details` | `brand`, `model`, `year`, `mileage`, `fuel_type`, `transmission`, `condition` | `car_details_mileage_nonnegative` (`0013:167`), `car_details_year_plausible` (`0013:169`) |
| Machinery | `machinery_details` | `machinery_type`, `brand`, `model`, `condition`, `year`, `usage_hours` | `machinery_details_usage_nonnegative` (`0013:175`), `machinery_details_year_plausible` (`0013:177`) |

**Assessed correct:** machinery uses `usage_hours`, **not** mileage. The audit brief specifically flags
"mileage vs engine-hours correctness" for heavy equipment — the schema gets this right, and the enum
`machinery_condition` is distinct from the free-text `car_details.condition`.

**Gaps against the stated market requirements** (each is *absent from the database*, not merely from the UI):

| Vertical | Required by brief | Present? |
|---|---|---|
| Property | parking | ❌ |
| Property | land size vs built size, with units | ❌ (single `size_sqm`) |
| Property | tenure / title | ❌ |
| Property | utilities: borehole, solar, water, ZESA, sewer | ❌ |
| Property | furnishing, availability date | ❌ |
| Property | province / city / suburb | ⚠️ via `location_id` → `locations` only |
| Cars | **duty / import status** (called out as materially important) | ❌ |
| Cars | variant, engine size, drivetrain, body type | ❌ |
| Cars | VIN / chassis | ✅ correctly **absent** (privacy-positive) |
| Machinery | capacity / payload, axles, attachments, certification, transport notes | ❌ |

Fields defined in the dead registry do not count as captured. → **F-021 (P2)**

## 2.3 Listing state machine — MVP boundary correctly implemented

`listing_status` enum, reconstructed across migrations:

- `0001:15` — `draft, available, under_offer, sold, rented, expired`
- `0020:6-9` — adds `pending_review`, `rejected`, `paused`, `unavailable`

```
                    ┌─ (insert) ─────────────────────────────┐
                    │  trigger auto_publish_validated_mvp    │
      draft ────────┤  pending_review ──► available          │
                    └────────────────────────────────────────┘
  available ──pause──► paused ──resume──► available
  available/under_offer/rented/paused ──unavailable──► unavailable
  draft|rejected|expired|unavailable ──submit──► available   (requires ≥1 validated image)
```

**`20260807030000_remove_listing_content_review_from_mvp.sql` is correct and complete:**

- `private.auto_publish_validated_mvp_listing()` — BEFORE INSERT trigger rewrites `pending_review` → `available`, clearing `moderation_reason`, `expires_at`, `expiry_notice_sent_at`
- Backfill: `update public.listings set status='available' where status='pending_review'` — no rows stranded
- `public.owner_transition_listing(uuid, text)` — `SECURITY DEFINER`, `set search_path = ''`, `is_active_user()` gate, action allowlist, `where id=… and seller_id=auth.uid() FOR UPDATE` (ownership + row lock), media precondition on `submit`, correct SQLSTATEs, `revoke all … from public, anon` + `grant execute … to authenticated`
- `public.protect_listing_managed_fields()` — blocks a seller from mutating `id`, `kind`, `seller_id`, `status`, `verified`, `views`, `created_via`, `created_at`, `submission_key`, `submitted_at`, `moderation_reason`, `expires_at`, `expiry_notice_sent_at`

Appendix C **"Valid listings publish without human review" = PASS** (repo-certified).
`pending_review` and `rejected` remain in the enum as **legacy vocabulary**, unreachable for ordinary
listings — correctly classified as harmless residue rather than an active review dependency.

## 2.4 Listing submission — server validation assessed strong

`create_v1_listing_submission` (`0046`) enforces server-side, before any write:

| Control | Evidence |
|---|---|
| Active account | `is_active_user()` |
| **Idempotency** | `submission_key` lookup returns the existing listing on replay; different owner → `23505` |
| Title | 10–160 chars |
| Description | 50–5000 chars |
| **Price** | `> 0` and `≤ 999999999999.99` — negative and zero rejected |
| **Currency** | `^[A-Z]{3}$` **and** `is_supported_listing_currency(country, currency)` — country-scoped |
| Country | `is_country_publishable(country)` |
| Offer type | `in ('sale','rent')` |
| **Category** | slug regex **and** existence in `public.categories` with matching `marketplace_kind`, `parent_id is not null`, `is_active` |
| Contact | length bounds, email regex, **at least one method required** |
| Location | must exist and be `is_active` |
| Media count | 1–20 |
| **Media ownership** | each item must match a `listing_upload_intents` row with `user_id = auth.uid()`, `state='uploaded'`, `expires_at > now()`, **and** a `storage.objects` row in `listing-images` with matching `owner_id`, `mimetype` and `byte_size`; `FOR UPDATE` lock; duplicate-path rejection |
| Publication | inserts `status = 'available'` directly — immediate, no review |

This satisfies Appendix C **"Submission validates server-side"**, **"Media ownership enforced"**,
**"Category data stored atomically"** (single transaction: listing + detail row) — all PASS.

**One gap:** `p_detail` values are cast but not range-checked inside the RPC. Protection comes only from
column types plus the four CHECK constraints in §2.2. So `bedrooms = 9999` or `size_sqm = 0.01` are
accepted, and `property_type`/`machinery_type` fall back to `'other'` via `coalesce(nullif(...), 'other')`
rather than rejecting an unknown value. → **F-022 (P3)**

## 2.5 Seller contact boundary — verified closed

An earlier hypothesis in this audit was that `authenticated` retained column SELECT on
`contact_phone`/`contact_whatsapp`/`contact_email`, allowing any account holder to bypass the reveal RPC's
audit log and rate limit. **That gap was real, was found by the project, and is closed.**

- `0109_seller_contact_reveal_boundary.sql:49-52` — revokes the raw columns from `anon`, adds generated
  `has_contact_*` booleans so cards still render affordances, and introduces an audited, rate-limited reveal RPC.
  Its own header notes the residual: `authenticated` kept the grant for the owner edit prefill.
- `0115_owner_contact_access_boundary.sql:184-190` — **closes it**, revoking the columns from `authenticated`
  too and replacing the owner path with `owner_listing_contacts` / owner-scoped `SECURITY DEFINER` functions.

The `0115` header documents the staging reproduction verbatim — *"acting as an ordinary authenticated user
with no relationship to the seller: `select count(contact_phone) from public.listings where seller_id = <other user>` → 2"* —
and additionally fixes owners consuming their own reveal budget. **Recorded as a strength.**
Full projection verification continues in Phase 3.

## 2.6 Taxonomy — two axes, complementary rather than drifted

Initial reading suggested drift between a ~75-slug database taxonomy and a 26-subtype UI taxonomy.
Tracing consumers shows they are **different axes**:

| Axis | Source | Values | Consumers |
|---|---|---|---|
| `listings.category` (slug) | `public.categories` table | ~75 seeded slugs across 4 `marketplace_kind` values | Validated by the submission RPC; `admin_category_rows`; `businessPublishingService`; `servicesService` |
| Registry `subtypes` | `src/domain/listingSchema/` | 26 (property 5, vehicle 7, machinery 10, service 4) | **None — dead (§2.1)** |

So there is no live contradiction, because one side is not live. Full detail in `category-tree.md`.

`public.categories` is well-modelled: slug regex CHECK, `parent_id` self-FK `on delete restrict`,
`marketplace_kind` CHECK constrained to the four verticals, `sort_order` bounded 0–10000, `is_active`,
`is_protected`, and `unique nulls not distinct (parent_id, slug)`.

## 2.7 Money & currency

- `listings.price numeric(14,2)` — correct exact-decimal type, no float. Same for `deposit`, `agent_fee`, `additional_fees`.
- `currency text not null default 'USD'` — **explicit currency on every row**, plus `native_price`/`native_currency` retained.
- `listings_price_nonnegative` (`0013:163`) and RPC-level `> 0`.
- Country-scoped currency validation via `is_supported_listing_currency`.

No float money, no implicit currency. Cross-currency sort/filter behaviour is a Phase 7 question.

## 2.8 Out-of-MVP tables carried in the schema

14 tables exist outside the stated MVP boundary and are audited as dead-code/security surface, **not** as
work to complete:

**Monetisation:** `payments`, `escrow_transactions`, `subscriptions`, `practitioner_payouts`
**Reputation:** `reviews`, `seller_ratings`, `practitioner_reviews`
**Social:** `follows`
**Legal-practitioner vertical** (absent from the stated taxonomy): `legal_practitioners`, `legal_specializations`, `legal_bookings`
**Other:** `service_bookings`, `service_disputes`, `announcements`

Each requires RLS verification in Phase 3 — a dormant table with a permissive policy is still reachable
through PostgREST. Detailed classification in Phase 7. → tracked as **F-023 (P2)**

## 2.9 Phase 2 findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-019 | P2 | CONFIRMED | The versioned category schema registry (~1,100 LOC) is entirely dead code |
| F-020 | P2 | CONFIRMED | `listings.attributes` / `services.attributes` are never written; the shape CHECK validates a permanently empty document |
| F-021 | P2 | CONFIRMED | Stored attributes are 4–7 columns per vertical; duty/import status, utilities, tenure, capacity and land-vs-built size are absent from the database |
| F-022 | P3 | CONFIRMED | `p_detail` values are cast but not range-validated in the submission RPC; unknown enum values silently coerce to `'other'` |
| F-023 | P2 | CONFIRMED | 14 out-of-MVP tables (payments, escrow, subscriptions, ratings, reviews, legal practitioners, bookings) remain in the schema as live attack surface |

**No P0 identified in Phase 2.**

## 2.10 Strengths recorded

- Immediate-publication MVP boundary implemented correctly and completely, including backfill.
- Submission RPC validation is thorough: idempotency key, price/currency/country/category/contact/media checks, atomic listing+detail insert.
- Media ownership proven against `storage.objects` metadata (owner, mimetype, byte size) under a row lock — this defeats attach-someone-else's-upload and swap-after-intent attacks.
- `protect_listing_managed_fields()` prevents sellers from self-setting `verified`, `status` or `views`.
- Contact reveal boundary closed in two deliberate steps with a documented staging repro.
- Exact-decimal money with explicit per-row currency and country-scoped currency validation.
- Machinery correctly modelled on engine-hours rather than mileage.
