# PHASE 07 — PRICING, CURRENCY & NON-MONETISATION BOUNDARY

**Audited ref:** `origin/main` @ `ee6f212`

## 7.1 Money correctness — PASS

| Control | Evidence |
|---|---|
| Type | `listings.price numeric(14,2)`; `deposit`, `agent_fee`, `additional_fees` likewise. **No float money anywhere.** |
| Explicit currency | `listings.currency text not null default 'USD'` on every row, plus `native_price` / `native_currency` |
| Non-negative | `listings_price_nonnegative` (`0013:163`), `services_price_nonnegative` (`0013:179`) |
| Server bounds | RPC enforces `> 0` and `<= 999999999999.99` |
| Format | `currency !~ '^[A-Z]{3}$'` rejected |
| **Country scoping** | `is_supported_listing_currency(country_code, currency)` — a currency must be valid *for the listing's country* |
| Publishability | `is_country_publishable(country_code)` |
| Negotiable | `accepts_offers boolean not null default false` |

Supported currencies are **data-driven** via `country_configs` and `exchange_rates` (both public reference
tables), not hardcoded. The audit does **not** assume USD+ZWG; the actual set is whatever `country_configs`
holds, which requires live confirmation (**E-004**).

## 7.2 Cross-currency comparison risk

Search filters and sorts on `listings.price` while `currency` is a sibling column. If a result set mixes
currencies, a "price low→high" sort or a price-range filter compares raw numbers across denominations, so a
listing priced 500 in one currency ranks against 500 in another.

`featureFlags.currencyConversion` is **false** by default and `exchange_rates` exists but no normalising
price column (e.g. `price_usd`) is written at submission time.

→ **F-036 (P2)** — cross-currency ordering can mislead buyers. Mitigation is either a normalised sort key
written at insert, or constraining result sets to a single currency per country context.

## 7.3 Non-monetisation boundary — CLEAN

The MVP excludes checkout, escrow, payouts, subscriptions, boosts, commissions and wallets. Classification
of every artifact found:

| Artifact | Location | Classification |
|---|---|---|
| `VITE_FEATURE_PAYMENTS`, `_SUBSCRIPTIONS`, `_ESCROW`, `_PREMIUM_LISTINGS` | `featureFlags.js:52-55` | **Dead** — all default `false`; `validate-env.mjs` rejects enabling them without a complete implementation |
| `payments`, `escrow_transactions`, `subscriptions`, `practitioner_payouts` tables | migrations | **Dead** — RLS enabled, **zero policies** = deny-all (Phase 3 §3.6) |
| `reviews`, `seller_ratings`, `practitioner_reviews`, `follows` | migrations | **Dead** — admin-SELECT-only |
| `legal_practitioners`, `legal_specializations`, `legal_bookings` | migrations | **Dead** — deny-all; an entire vertical outside the stated taxonomy |
| `service_bookings`, `service_disputes` | migrations | **Dead** — deny-all |
| Legal copy | `legalContent.js:269` | **Correct** — *"Payment, escrow, and subscription features are not currently offered"* |
| FAQ copy | `FAQs.jsx:28-29` | **Correct** — *"Does PeekaListing process payments? No…"* and warns against sending money early |

**No payment provider integration exists.** Grepping `src/` for `paynow`, `ecocash`, `stripe`, `escrow`
returns only `featureFlags.js`, `legalContent.js` and `FAQs.jsx` — all declaration or disclaimer text.
There is **no half-built checkout to audit as a dangerous partial implementation.**

This is a genuinely clean boundary and is recorded as a strength. The residual issue is schema debt only
(**F-023, P3**), not reachable functionality.

**No mobile-money requirement is invented**, per the brief.

## 7.4 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-036 | P2 | CONFIRMED | Price sorting and range filtering compare raw numbers across currencies with no normalised sort key |
