# PHASE 13 — PRIVACY, DATA PROTECTION & LEGAL SURFACES

**Audited ref:** `origin/main` @ `ee6f212`
**All legal conclusions in this phase are flagged `REQUIRES PROFESSIONAL REVIEW`. This is issue spotting, not legal advice.**

## 13.1 HEADLINE — the published legal documents are incomplete

`src/lib/legalContent.js` (404 LOC) is rendered live at `/legal/:document` via `LegalPage.jsx:15-16,42`.
It contains unfilled editorial placeholders:

| Line | Placeholder | Document |
|---|---|---|
| `:22` | *"FindIt is operated by **[TO BE COMPLETED: operator legal name]**, registered at **[TO BE COMPLETED: registered address]**"* | Privacy Policy |
| `:215` | same construction | **Terms of Service** |
| `:116` | *"[TO BE COMPLETED: confirm exact retention periods for each category and state them here in days or months…]"* | Privacy Policy |
| `:292` | *"[TO BE COMPLETED: confirm whether an aggregate liability cap is to be stated…]"* | Terms |
| `:197` | provider-list completion note | Data protection |

`src/lib/legalContentOverrides.js:1-11` overrides exactly **two** paragraphs, both about deletion/export.
It does **not** touch any placeholder — verified by reading the whole 11-line file.

So the binding user agreement and the privacy notice, on a marketplace that collects **identity documents
and a selfie** for business verification (`legalContent.js:40`), identify **no operating entity, no address
and no retention periods** — and name a product ("FindIt", **F-001**) that is not the one launching.

→ **F-011 (P1)**, already recorded in Phase 0; confirmed and expanded here.

## 13.2 Personal data inventory

| Category | Location |
|---|---|
| Account | `users` — email, `full_name`, phone, `phone_verified`, OTP fields, `status`, ban fields |
| Seller contact | `listings`/`services` — `contact_phone`, `contact_whatsapp`, `contact_email` (revoked from `anon` and `authenticated`) |
| **Business verification evidence** | `business_applications`, `verification_requests` — ID document, trade document, selfie (`legalContent.js:40`) |
| **Precise location** | `listing_private_locations` — `exact_latitude`, `exact_longitude`, `exact_address`, `provider_place_id` |
| Media | `listing-images`, `marketplace-images`, `tour-playback`, `tour-thumbnails` |
| Messages | `conversations`, `inquiries`, `support_messages` |
| Behavioural | `contact_reveal_events`, `tour_view_events`, `recommendation_events`, `recommendation_personalization_preferences` |
| Device / push | `web_push_subscriptions`, `web_push_delivery_jobs` |
| Audit | `audit_logs`, `business_review_events`, `recommendation_configuration_audit` |

## 13.3 Data subject rights

| Right | State |
|---|---|
| **Deletion** | **Implemented** — `supabase/functions/delete-account/index.ts`, `account_deletion_receipts` table, `DeleteAccountSection.jsx`, and `0057_recommendation_eligibility_geospatial_and_deletion_closure.sql`. The override copy accurately describes immediate closure plus anonymised retention of safety/dispute/audit records. |
| **Export** | **Not implemented** — the override text states plainly: *"Self-service data export is not yet available and export requests are handled through support."* Honest, but a manual-only process with no documented SLA or runbook. → **F-048 (P2)** |
| Correction | Profile editing exists |
| **Retention** | **Undefined in the published policy** (`:116` placeholder), though the schema shows real retention machinery (30/90/180-day intervals across 8 migrations) |
| Consent | `recommendation_personalization_preferences` records personalisation consent and version — genuinely good |

## 13.4 Zimbabwe Cyber and Data Protection Act posture — issue spotting only

`REQUIRES PROFESSIONAL REVIEW` for every item below.

1. **Controller identity** — the Act contemplates an identifiable data controller. The policy names none (`:22`). **Highest-priority item.**
2. **Cross-border transfer** — `legalContent.js:105` acknowledges infrastructure hosted outside Zimbabwe (Supabase/Vercel/Cloudflare). Transfer basis is asserted but the destination countries and safeguards are not enumerated.
3. **Retention periods** — required to be stated; currently a placeholder.
4. **Sensitive data** — identity documents and a selfie are collected for verification; handling, retention and deletion of that evidence should be explicitly addressed.
5. **Data subject requests** — export is manual with no stated timeframe.
6. **Estate-agent considerations** — property listings by non-agents may engage estate-agency regulation; out of audit scope, flagged for counsel.

## 13.5 Terms vs actual practice — accuracy check

| Claim | Reality | Verdict |
|---|---|---|
| "Payment, escrow, and subscription features are not currently offered" (`:269`) | No payment integration exists anywhere | **Accurate** |
| "FindIt does not verify the accuracy of listings, the condition or ownership of items" (`:223`) | True | **Accurate** |
| "does not set advertising cookies… does not share browsing behaviour with advertising networks" (`:318`) | No analytics or ad SDK exists (Phase 12) | **Accurate** |
| Seller photo rights / licence grant (`:275`) | Present and reasonable | **Accurate** |
| Takedown route (`:277`) | Contact Support; report flow exists | **Accurate** |
| Processor list (Supabase/Vercel/Cloudflare/maps) | `:197` notes the list needs confirming before production | **Incomplete** |

The substance is careful and honest; the defect is completion, not accuracy.

## 13.6 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-011 | P1 | CONFIRMED | *(Phase 0, expanded)* Live Privacy Policy and Terms carry unfilled operator-identity, address, retention and liability placeholders |
| F-048 | P2 | CONFIRMED | No self-service data export; requests are manual with no documented process or SLA |
