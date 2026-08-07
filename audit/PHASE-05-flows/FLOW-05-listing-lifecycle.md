# FLOW-05 — Listing lifecycle (edit, pause/resume, relist, unavailable, delete)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/my-listings` → `MyListings.jsx` (380 LOC) → `ownerListingsRepository` → **`owner_transition_listing(p_listing_id, p_action)`** (`20260807030000`).
Edit → `EditListingDialog.jsx`; owner contact prefill goes through `owner_listing_contacts` (`0115`), **not** direct column reads.

## State machine
```
draft|rejected|expired|unavailable --submit--> available   (requires >=1 listing_media row)
available|under_offer|rented       --pause---> paused
paused                             --resume--> available
available|under_offer|rented|paused --unavailable--> unavailable
```

## Assessment
| Aspect | State |
|---|---|
| Ownership | PASS — `where id=… and seller_id=auth.uid() FOR UPDATE` |
| **No routine review** | PASS — no action routes to `pending_review`; the insert trigger rewrites it if it ever appears |
| Managed-field tampering | PASS — `protect_listing_managed_fields()` blocks `status`, `verified`, `views`, `seller_id`, `submission_key` |
| Relist | PASS — `submit` from `expired`/`unavailable`/`rejected` returns straight to `available` |
| Media precondition | PASS — `submit` requires at least one validated image |
| Error semantics | Explicit SQLSTATEs (`42501`, `22023`, `P0002`) |

## Gaps
- `sold`, `rented` and `under_offer` exist in the enum but are **not reachable** through `owner_transition_listing`, whose action allowlist is `submit|pause|resume|unavailable`. A seller cannot mark an item sold — only "unavailable". **F-029 (P2)**: for a marketplace this removes a meaningful and expected signal, and conflates "sold" with "withdrawn".
- `rejected` and `pending_review` remain in the enum as legacy vocabulary (harmless).
