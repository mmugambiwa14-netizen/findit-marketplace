# FindIt Marketplace — Technical & Base44 Dependency Audit

> **2026-07-17 scope note:** this document is the original pre-/early-migration
> source audit and is retained as historical evidence. It does not by itself
> satisfy the five MD1 discovery deliverables and its counts/auth descriptions
> are not a post-Phase-2B verification. See `PHASE_0_TO_2B_VERIFICATION.md` and
> the five root discovery documents for the authoritative current assessment.
> Current checkpoint: the Base44 Vite plugin has been removed, Supabase owns
> the public browse/detail/Favourite/report, owner/profile/seller/services/admin/
> business, product creation/edit media, service-photo creation/edit media and business/dealer-logo
> slices, while minimal messaging and essential notifications are build/API/SQL
> verified behind disabled readiness flags. Trusted V1 image paths use two
> private buckets, two purpose-bound upload Edge Functions and one internal
> lifecycle-cleanup Edge Function. The routed Favourites
> page and lightweight Help/Contact Support founder inbox also use Supabase
> end to end. 79 source
> modules still import the Base44 client. Counts and architecture statements
> in the historical audit below describe the original export.

**Date:** July 7, 2026
**Scope:** Full repository audit prior to Base44 migration
**Target backend:** Supabase (Postgres + Auth + Storage)

---

## 1. Executive Summary

FindIt is a Zimbabwe-focused marketplace for cars, property, machinery, and professional services (legal practitioners, dealers), with escrow payments, a support-ticket system, verification/KYC, and AI-assisted moderation.

The exported project is **frontend-only**. There is no independent backend in this repo — the real application logic lives entirely inside Base44's hosted platform, represented here as two parallel trees:

- `src/` — the React 18 + Vite frontend (279 files, 80 pages)
- `base44/` — declarative backend definitions Base44 compiled from: **40 entity schemas**, **59 serverless functions** (Deno, calling the Base44 SDK), and **3 AI agent configs**

This is a **full-stack migration**, not a refactor. Nearly half the frontend (130/279 files, 47%) imports the Base44 SDK directly, with no repository/service abstraction layer to swap out. Every one of the 59 backend functions needs to be rebuilt as a real endpoint. Authentication, storage, and payments are 100% Base44-hosted today.

**Bottom line:** this is a multi-phase project on the order of weeks, not a single pass. The plan below sequences it so the app stays functional at each checkpoint.

---

## 2. Repository Structure

```
src/
  api/base44Client.js       — single Base44 SDK client instance
  agents/                   — 4 JSON configs (support assistant, content moderator, ban-evasion detector, agent manager)
  components/               — 20+ feature folders (listings, business, bulk, verification, admin, messaging, map, ...)
  entities/                 — only 3 JSON files (stale/partial — real schemas are in /base44/entities)
  hooks/                    — 8 hooks (useUnreadAlerts, useFollowerCount, useVerificationTier, ...)
  lib/                      — AuthContext, CurrencyContext, app-params, bulk import helpers, geocoding
  pages/                    — 80 route components, incl. 24 admin pages
  utils/
base44/
  entities/                 — 40 *.jsonc schema files (source of truth for data model)
  functions/                — 59 Deno serverless functions (source of truth for backend logic)
  agents/                   — 3 AI agent configs (oppah, tintin, support_agent)
```

**Frontend stack:** React 18, Vite 6, React Router 6, TanStack Query 5, Tailwind + Radix + shadcn-style UI, React Hook Form + Zod, Stripe.js, Leaflet, Recharts, jsPDF, react-quill.

**Architectural observation:** there's no `services/` or `repositories/` abstraction in the frontend — components call `base44.entities.X.create()/list()/update()` and `base44.functions.Y()` directly. This is the single biggest cost driver for the migration: every call site needs to be touched, not just one client file.

---

## 3. Base44 Dependency Audit

### 3.1 SDK usage
- `@base44/sdk` and `@base44/vite-plugin` are dependencies; the Vite plugin (`vite.config.js`) injects HMR notifications, navigation tracking, analytics, and a "visual edit agent" — all Base44-proprietary dev tooling that goes away entirely (no replacement needed, it's build tooling not app logic).
- 130 files import from `@/api/base44Client`, split roughly evenly between `entities.*` CRUD calls and `functions.*` invocations.
- **Difficulty to replace:** High effort, low risk. It's mechanical (swap SDK calls for Supabase client calls / RPC), but the volume (130 files) means this can't be done as a single find-and-replace — data shapes and error handling differ.

### 3.2 Authentication
- `AuthContext.jsx` does **not** implement its own session logic — it calls Base44's hosted `/api/apps/public` endpoint and manages a Base44-issued access token.
- **Security issue found:** the access token can arrive as a URL query parameter (`app-params.js`, `getAppParamValue("access_token")`) and is persisted to `localStorage`. URL-carried tokens leak via browser history, referrer headers, and server access logs. This pattern must not carry over to the new auth system.
- Role checks (`ProtectedRoute.jsx`) do re-verify role server-side via `base44.auth.me()` rather than trusting local state — that part is sound and should be preserved as a pattern (never trust a client-cached role for authorization).
- **Replacement:** Supabase Auth (email/password + optional OAuth), with RLS policies enforcing role/ownership at the database level instead of only in a serverless function.

### 3.3 Data / Entities
- 40 entities, none normalized as relational tables today — each is a flat Base44 "entity" (effectively a document collection) with `_id`/`_email` string fields standing in for foreign keys (25 of 40 entities have these). No real FK constraints, indexes, or enum enforcement exist outside what Base44's schema validator does at write time.
- Notably large/central entities: `Car` (32 fields), `Machinery` (31), `Property` (29), `SupportTicket` (26), `ServiceBooking` (22), `LegalPractitioner` (23), `EscrowTransaction` (15).
- **Replacement:** full relational redesign in Postgres — see §4.

### 3.4 Serverless Functions (59 total)
Grouped by concern:
- **Ticketing/support** (assignTicket, autoUpdateTicketStatus, createTicket, getTicket*, sendTicketMessage, sendTicketStatusEmail, updateTicketStatus, generateTicketNumber, ticket-related notify* — ~20 functions): heaviest cluster, includes an LLM call (`InvokeLLM`) inside `createTicket` to auto-triage priority.
- **Admin/moderation** (banUser, suspendUser, promoteToAdmin, setSuperAdmin, updateUserRole, getAllUsers, getAdminStats, getRevenueStats, reviewVerification, verifyPractitioner, resolveLegalDispute): privileged operations that must become RLS-guarded Postgres functions or protected API routes — never client-callable without server-side role checks.
- **Listings lifecycle** (getAllListings, deleteListing, expireListings, onListingStatusChange, notifyFollowersNewListing): includes at least one scheduled/cron-style job (`expireListings`) that needs a real scheduler (Supabase Cron / pg_cron) post-migration.
- **Notifications/email** (notifyAdmins, notifyNewFollower, notifyNewMessage, sendTemplatedEmail, seedEmailTemplates): needs a transactional email provider (e.g. Resend/Postmark) — none is wired up in what's exported.
- **Phone/OTP verification** (sendPhoneOtp, verifyPhoneOtp, setUserPhone): needs an SMS provider (e.g. Twilio) — not present in the export, was presumably a Base44 integration.
- **Analytics/reporting** (getAnalytics, getAdminStats, getRevenueStats, getExchangeRates): straightforward to reimplement as SQL views/RPCs.
- **One-time/ops** (bootstrapSuperAdmin, backfillVerifiedUsers, seedLocations, ensureAdminVerified): admin scripts, not runtime app logic — can become one-off migration scripts, not part of the ongoing backend.

Every function is a thin Deno wrapper around `base44.entities.*` / `base44.asServiceRole.*` calls — logic is generally simple CRUD + a notification side-effect, which is good news: it ports cleanly to Postgres functions/RPCs or thin API routes, it's just a lot of surface area (59 endpoints).

### 3.5 AI Agents
- 3 agent configs (`oppah`, `tintin`, `support_agent`) plus a `contentModerator` and `banEvasonDetector` (note: filename typo "banEvasonDetector" — carries into the new codebase, worth fixing) referenced from `src/agents/*.json`.
- These currently run through Base44's `asServiceRole.integrations.Core.InvokeLLM`. Post-migration these become direct calls to an LLM provider (e.g. Anthropic API) from a proper backend service — never from the browser, since it would require exposing an API key client-side.

### 3.6 Storage
- File/image upload call sites found in 14 components (listing photo/document steps, verification documents, business profile logos, bulk PDF import, credential uploads, chat attachments).
- No validation, compression, or size-limit logic is visible in the exported frontend — this logic likely lived in Base44's hosted upload handler. **Must be rebuilt explicitly** (see §7) since Supabase Storage does not do this automatically.

### 3.7 Payments
- `Stripe.js`/`@stripe/react-stripe-js` are wired into 4 files (`PaymentPage.jsx`, `Step7Package.jsx`, `LegalBookingModal.jsx`, `FAQs.jsx`).
- The `EscrowTransaction` schema already models a `payment_method` enum: `ecocash, innbucks, bank_transfer, stripe, manual` — i.e. the product already needs to support Zimbabwean mobile-money/bank rails alongside Stripe, most of which are manual/reconciliation-based today (no gateway API integration visible in the export).
- No payment secret keys are present in the repo (checked — clean).

---

## 4. Proposed Data Model (Supabase/Postgres)

Direction for the redesign (detailed migration SQL comes in Phase 1, not this document):

- Convert every `*_email` reference (seller_email, user_email) to a proper `user_id UUID REFERENCES users(id)` foreign key. Email-as-identifier is fragile (breaks on email change, no referential integrity) — this is the single highest-value schema fix.
- Split `Car` / `Property` / `Machinery` into a shared `listings` base table (common fields: seller, price, currency, location, status, photos, views) plus per-category detail tables — reduces duplication across the 3 near-identical 30-field schemas and simplifies search/indexing.
- Add real foreign keys + indexes for: `listing_id`, `user_id`, `booking_id`, `ticket_id` across Inquiry, Follow, SavedListing, ServiceBooking, EscrowTransaction, Review, Report.
- Enforce enums at the DB level (Postgres `ENUM` or `CHECK` constraints) for fields like `escrow_status`, `payment_method`, `status` — currently only enforced client-side/at the Base44 schema layer.
- Add composite indexes for the obvious hot paths: listings by `(category, status, created_at)`, tickets by `(status, priority)`, messages by `(conversation_id, created_at)`.

---

## 5. Security Findings

| Finding | Severity | Notes |
|---|---|---|
| Access token accepted via URL query param, persisted to localStorage | High | Leaks via browser history/referrer/logs. Replace with httpOnly session cookies or Supabase's standard token handling. |
| Privileged admin functions (ban, promote, role changes) are plain callable functions | High | Must be re-implemented behind RLS + server-side role checks, not just "callable but checks a flag." |
| No visible upload validation (file type/size) on 14 upload call sites | Medium | Must add MIME/size validation + re-encoding before storage to prevent malicious file uploads. |
| No rate limiting visible on OTP/email functions (sendPhoneOtp, sendTemplatedEmail) | Medium | Needed to prevent SMS/email pumping abuse. |
| No secrets committed to the repo | — (clean) | Verified via pattern scan; good baseline to maintain. |

Standard OWASP items to close out during the rebuild: CSRF protection on state-changing requests, output encoding for user-generated text (bios, listing descriptions, messages) to prevent stored XSS, and server-side authorization checks on every one of the 59 replaced endpoints (not just the ones flagged above).

---

## 6. Code Quality Observations

- Feature-folder organization under `src/components/` is reasonable and worth keeping.
- The Base44 SDK is called directly from components/pages in most places rather than through hooks or a service layer — this is the main thing to fix during migration so the *next* backend swap (if ever needed) doesn't repeat this problem. Recommend a `src/services/*.ts` layer wrapping all Supabase calls, with pages/components never importing the Supabase client directly.
- `src/entities/*.json` (3 files) appears to be stale scaffolding left over from an earlier export — the real schemas are in `base44/entities/`. Recommend deleting the stale copies to avoid confusion.
- Filename typo carried through the codebase: `banEvasonDetector` → should be `banEvasionDetector`.
- 24 separate admin pages under `pages/admin/` with what looks like significant shared layout/data-fetching logic (stats, tables, filters) — good candidate for a shared `AdminDataTable`/`useAdminQuery` abstraction to cut duplication once ported.

---

## 7. Storage & Media

To replace Base44's hosted upload handling with Supabase Storage:
- Bucket-per-purpose (`listing-photos`, `verification-docs`, `avatars`, `ticket-attachments`) with per-bucket RLS policies.
- Client-side image compression before upload (listing photos, avatars) to control storage cost and load time.
- Signed URLs for private buckets (verification docs, credentials) — these must never be public.
- Server-side MIME-type + size validation on top of client-side checks (never trust the client alone).

---

## 8. Migration Roadmap (Phased)

1. **Phase 0 — Audit (this document).** Done.
2. **Phase 1 — Foundation.** Supabase project setup, relational schema + migrations for all 40 entities (redesigned per §4), RLS policies, Supabase Auth wired up, session handling in a new `AuthContext` with no Base44 dependency.
3. **Phase 2 — Service layer.** Build `src/services/*` wrapping every Supabase call (entities + RPC equivalents of the 59 functions), fully isolated from UI code.
4. **Phase 3 — Frontend cutover.** Go page-by-page/component-by-component replacing direct Base44 SDK calls with the new service layer. Highest-traffic flows first (browse/search, listing detail, auth) then admin, then long-tail (bulk import, legal bookings).
5. **Phase 4 — Storage & uploads.** Move file/image upload flows to Supabase Storage with validation and compression.
6. **Phase 5 — Payments.** Stripe integration hardened (webhooks, idempotency); design/scope the Ecocash/InnBucks/bank-transfer reconciliation flow (likely semi-manual given these are not standard gateway APIs).
7. **Phase 6 — Notifications, email, SMS, AI agents.** Wire a transactional email provider, SMS/OTP provider, and move `InvokeLLM` calls to a server-side Anthropic (or similar) integration.
8. **Phase 7 — Security & performance pass.** Close the findings in §5, add pagination/caching where missing, bundle/lazy-load audit.
9. **Phase 8 — Testing & deployment.** Critical-path tests (auth, listing CRUD, payments, ticketing), CI/CD, production environment config.

Each phase should leave the app in a runnable state — no "big bang" cutover.

---

## 9. Immediate Next Step

Phase 1: set up the Supabase project, write the full relational schema + migration files for all 40 entities, and replace `AuthContext`/`ProtectedRoute` with Supabase Auth. Ready to start whenever you are — say the word and I'll begin with the schema + migrations.
