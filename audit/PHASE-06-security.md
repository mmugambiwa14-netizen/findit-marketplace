# PHASE 06 — APPLICATION SECURITY

**Audited ref:** `origin/main` @ `ee6f212` · Static + local build evidence PASS · Hosted BLOCKED E-003/E-004/E-005

## 6.1 Secrets

| Surface | Result |
|---|---|
| Repository history | **CLEAN** — no `.env`/`.env.*` ever committed |
| Tracked files | **CLEAN** — 2 secret-shaped hits, both detector patterns (`scripts/verify-repository-hygiene.mjs`, `docs/SECURITY_REVIEW.md`) |
| Browser bundle | **CLEAN** — `SERVICE_ROLE` occurrences: `src/` **0**, Edge Functions 11 files, Workers 1 file; `verify-bundle-secrets.mjs` passes against a real `dist/` |
| Source maps | **CLEAN** — 0 `.map` files in `dist/` |

**Appendix C "No secrets in repo/history/browser" and "Service-role server-only" = PASS.**

## 6.2 Injection

| Vector | Assessment |
|---|---|
| SQL | Writes go exclusively through parameterised `SECURITY DEFINER` RPCs; no string-concatenated SQL found. `search_path` pinned on all 165. |
| Search / order | Search uses RPC parameters (`p_cursor_value`, `p_cursor_id`, `p_limit`), not client-supplied ORDER BY |
| **XSS** | **No `dangerouslySetInnerHTML` anywhere in `src/`.** All 10 `target="_blank"` links carry `rel="noopener noreferrer"` (10/10) |
| URL injection | `src/lib/safeUrl.js` enforces an http(s) scheme allowlist **at render time**, with a docstring that explicitly reasons "anyone can write directly to PostgREST with their own key and store `javascript:` or `data:`… React 18 warns but still renders it". Applied at `PublicBusinessProfile.jsx:76-77` for `website` and every `social_links` entry. **Exemplary.** |
| Text | `src/lib/sanitizeText.js` applied in `serviceContracts`, `ownerListingContracts`, `peekThreads/requestContracts` |
| CSP | `script-src 'self'` with no `unsafe-inline`/`unsafe-eval`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'` (`vercel.json:17`) |

## 6.3 Upload abuse

Strong. `create_v1_listing_submission` proves every media item against `listing_upload_intents`
(`user_id = auth.uid()`, `state='uploaded'`, unexpired) **and** against `storage.objects` on `owner_id`,
`metadata->>'mimetype'` and `(metadata->>'size')::integer`, under `FOR UPDATE`, rejecting duplicate paths and
capping at 20 items. Peek buckets are private with server-side limits (`tour-playback` 250 MB `video/mp4`;
`tour-thumbnails` 5 MB `image/webp`).

**Gap:** EXIF/GPS stripping is not evidenced in the repository for listing images. The Peek pipeline
produces derivatives (implying re-encode), but the still-image path has no visible strip step.
→ **F-033 (P2)** — for a marketplace that deliberately coarsens property coordinates (`0049`), shipping
original camera EXIF with embedded GPS in a listing photo would defeat that control entirely.

## 6.4 Rate limiting — pervasive

Implemented in **8** migrations across the abuse-relevant surfaces:

| Surface | Migration |
|---|---|
| Messaging | `0018_v1_messaging.sql` |
| Contact support | `0025`, `0095` |
| Tour reports / moderation | `0034` |
| Listing–tour integration | `0037` |
| **Contact reveal** | `0109` — 40 per rolling 24 h, `54000` |
| Peek request read | `0117` |
| Peek request write | `0119` + 10-minute duplicate window (`20260804191200:39`) |

**Gap — Turnstile is deployed but never invoked.** `supabase/functions/verify-turnstile/index.ts` exists and
`TURNSTILE_SECRET_KEY` / `TURNSTILE_ALLOWED_ORIGINS` / `TURNSTILE_ALLOWED_HOSTNAMES` are read server-side, but
**no file in `src/` references Turnstile at all**. The bot-protection function is orphaned: signup, listing
creation, contact reveal and reporting have no CAPTCHA challenge in front of them.
→ **F-034 (P2)**

## 6.5 PII exposure sweep

| Response shape | Verdict |
|---|---|
| Public listing (35-column allowlist) | Contacts revoked; exact coordinates never granted — **PASS** |
| Public service | Same — **PASS** |
| Public business profile | Served via `private.public_business_profiles` projection, not the raw table — **PASS** |
| Peek playback | Signed URLs from private buckets — **PASS** |
| `marketplace_operational_controls` | `configuration` jsonb + `updated_by` admin UUID world-readable — **F-025 (P3)** |

## 6.6 Business-logic attacks

| Attack | Control | Verdict |
|---|---|---|
| Negative / zero price | RPC `price > 0`; `listings_price_nonnegative` | **BLOCKED** |
| Extreme price | `<= 999999999999.99` | **BLOCKED** |
| Currency manipulation | `^[A-Z]{3}$` + `is_supported_listing_currency(country, currency)` | **BLOCKED** |
| Duplicate reposting | `submission_key` idempotency | **BLOCKED** (identical replay) / partial for re-typed duplicates |
| Stolen media | intent + `storage.objects` owner/mimetype/size proof | **BLOCKED** |
| View inflation | `views` in `protect_listing_managed_fields()` | **BLOCKED** for owners; anonymous increment path unverified |
| Spam Peek Requests | 10-min duplicate window + `0119` rate limit | **LIMITED** |
| Spam messages | `0018` rate limit | **LIMITED** |
| **Contact scraping** | 40 reveals / 24 h / account, audited | **LIMITED** — see F-035 |
| Category bypass | leaf must match `marketplace_kind` and be active | **BLOCKED** |
| Business self-verification | admin-only decision path | **BLOCKED** |
| Ownership reassignment | `seller_id` in `protect_listing_managed_fields()` | **BLOCKED** |
| Wrong-seller fulfilment | `peek_request_parent_owner = auth.uid()` | **BLOCKED** |
| Late abandoned-attempt binding | `expire_stale_peek_request_fulfilments` + status triggers | **BLOCKED** |
| Retry amplification | explicit retry cap | **BLOCKED** |

→ **F-035 (P2)** — 40 reveals/24 h is per account, and account creation is free and un-CAPTCHA'd (F-034).
A scraper running 25 accounts harvests 1,000 seller contacts a day within policy, and `contact_reveal_events`
records it after the fact rather than preventing it. Contact harvesting is named in `0109`'s own header as
*"the primary real-world abuse target for a classifieds marketplace"*.

## 6.7 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-033 | P2 | LIKELY | No evidence of EXIF/GPS stripping on listing images, defeating deliberate coordinate coarsening |
| F-034 | P2 | CONFIRMED | Turnstile Edge Function is deployed but never invoked from the frontend |
| F-035 | P2 | CONFIRMED | Contact-reveal cap is per-account and account creation is unprotected, so scraping scales linearly with free accounts |

**No P0 identified in Phase 6.**
