# Peek Threads Phase 5 — Response binding handoff

Status: post-moderation Response Peek selection, request binding and deduplicated buyer notifications complete.

## Delivered

- Owner-scoped queue of approved, published and currently unbound Response Peeks.
- Request candidates limited to the same listing or service.
- Seller selection of 1–25 requests per Response Peek.
- Existing `bind_response_peek` flow extended rather than replaced.
- Previous current responses retained as history and marked superseded.
- Requests transition to answered only after an approved Response Peek is bound.
- Original requesters and all supporters receive an in-app alert.
- Notification recipients are deduplicated across all requests answered by the same Peek.
- Deep links route to the correct property, car, machinery or service detail page.
- Seller UI appears on `/peek-requests` after moderation approval.

## Preserved boundaries

- Upload, processing, moderation, private storage and playback remain unchanged.
- Main Listing Peek slots are not touched.
- Raw media paths are not exposed.
- Anonymous users cannot read seller binding queues or execute binding RPCs.

## Hosted state

Migration `0123_response_peek_binding_and_notifications.sql` is installed in staging. The UI becomes visible when an owned approved Response Peek is available and not yet bound.

## Remaining Phase 5 work

- Service detail integration for the public Peek Threads section.
- Replace the listing-detail decline prompt with the shared focus-managed dialog.
- Add a natural seller navigation entry for Buyer Peek Requests.
- Browser, keyboard, screen-reader and mobile acceptance.
