# FLOW-04 — Listing creation (draft → category → details → media → publish)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/post` (auth, `App.jsx:185`) → `CreateListing.jsx` (305 LOC), 5 steps: `Step1Category` → `ListingDetailsStep` → `ListingLocationStep` → `ListingMediaContactStep` → `ListingReviewStep` → `PublishSuccess`.
Draft: `usePersistentFormDraft` (own chunk in the build), step restored at `CreateListing.jsx:57`.
Submit: `listingCreationService.submitListing` → `listingCreationRepository.insertListingSubmission` (`:27-32`) → **`create_v1_listing_submission(p_submission_key, p_listing, p_detail, p_media)`** (`0046`).

## Assessment — the strongest flow in the product
| Control | Evidence |
|---|---|
| Server validation | title 10-160, description 50-5000, price >0 and bounded, currency `^[A-Z]{3}$` + country-scoped, `listing_type in ('sale','rent')`, contact bounds + email regex, ≥1 contact method, media 1-20 |
| Category authorization | must be an **active leaf** of `public.categories` matching `marketplace_kind` |
| **Idempotency** | `p_submission_key` — replay returns the existing listing; a different owner gets `23505` |
| **Media ownership** | each item matched to a `listing_upload_intents` row (`user_id = auth.uid()`, `state='uploaded'`, unexpired) **and** to `storage.objects` on `owner_id`, mimetype and byte size, under `FOR UPDATE`, with duplicate-path rejection |
| Atomicity | listing + detail row inserted in one transaction |
| **Immediate publication** | inserts `status='available'`; `auto_publish_validated_mvp_listing()` rewrites any `pending_review` |
| Double submit | prevented by the submission key |

## Gaps
- **F-019/F-020** — the registry-driven category attributes are collected nowhere and `attributes` is never written, so only 4-7 detail columns per vertical persist.
- **F-022** — `p_detail` is cast but not range-checked; unknown enum values coerce to `'other'`.
- **F-015 (SUSPECTED)** — Peek capture during creation uses `<input capture>` while the UI copy promises a browser camera permission that is never requested.
