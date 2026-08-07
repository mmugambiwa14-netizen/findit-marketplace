# FLOW-06 — Listing detail
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/property/:id` → `PropertyDetail.jsx`, `/car/:id` → `CarDetail.jsx`, `/machinery/:id` → `MachineryDetail.jsx` (all public, `App.jsx:163-165`) → `ListingDetailLayout.jsx` + `ListingDetailTabs.jsx` (Info / Description / Location / Seller) → `ListingMediaViewer.jsx` (554 LOC, the largest component) → `ContactButtons.jsx` → `PeekThreadsSection.jsx`.

## Assessment
| Aspect | State |
|---|---|
| Public projection | PASS — allowlist only; `has_contact_*` booleans drive affordances without values |
| Location | PASS — renders `public_latitude`/`public_longitude`/`public_location_label`; exact coordinates are in `listing_private_locations`, owner/admin only |
| Safety guidance | Present — `SafetyPanel` on `PropertyDetail.jsx:106` and `ServiceDetail.jsx:90` |
| Contact | Behind the reveal boundary (FLOW-10) |
| Peek surface | `PeekThreadsSection` / `ResponsePeekWatchButton`; gated by F-003 in production |

## Gaps
- **F-001** — seller fallback names render as "FindIt seller" (`ListingDetailLayout.jsx:46`, `ListingDetailTabs.jsx:158`) and safety copy says "FindIt does not handle payments" (`PropertyDetail.jsx:106`).
- **F-021** — the Info tab can only show the 4-7 stored detail fields; no tenure, utilities, duty/import status or capacity.
