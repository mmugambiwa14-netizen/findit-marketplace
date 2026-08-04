# Peek Threads Phase 5 — UI integration handoff

Status: buyer and seller flows are functionally integrated across asset listings and services. Response Peek upload, moderation-safe playback, post-approval request binding and deduplicated notifications are complete. Final repository-side work is accessibility cleanup and acceptance.

## Delivered

- Shared `PeekThreadsSection` component.
- Public filters: Top requests, Answered, Awaiting response and Newest.
- Structured request composer, category prompts and duplicate prevention.
- “I want this too” support flow.
- Property, Vehicle, Machinery and Service detail integration.
- Guest authentication guard on every request/support entry point.
- Explicit Response Peek playback by approved published Peek ID.
- Seller-wide Buyer Peek Requests queue at `/peek-requests`.
- Demand-and-age ranking with bounded keyset pagination.
- Existing `TourUploader` extended with explicit `peekKind="response"` mode.
- Response uploads reuse existing storage, signed intents, completion, processing and moderation.
- Response Peeks publish independently and cannot replace the Main Listing Peek.
- Post-approval “Which requests does this answer?” selector.
- One Response Peek can answer up to 25 compatible requests.
- Previous public responses remain in history when replaced.
- Requester and supporter notifications are deduplicated per buyer and Response Peek.
- Correct deep links for property, car, machinery and service threads.
- Natural seller entry from Profile to Buyer Peek Requests.
- Rollback capsules and static contracts for read, write, playback, queue, upload, binding, notifications and service integration.

## Preserved boundaries

- Components call service and repository boundaries; they do not query Supabase directly.
- No second video table, bucket, processing worker, moderation system, notification store or seller identity system was created.
- Main Listing Peek calls retain slot replacement semantics.
- Response Peeks bypass the Main Peek slot.
- Uploading or approval alone does not mark a request answered.
- Only an approved published Response Peek can be explicitly bound.
- Raw storage paths and playback URLs are excluded from public thread data.

## Hosted staging state

- `public_response_peek_metadata(uuid)` is installed.
- `tour-playback-access` version 13 supports Main and Response Peek playback.
- `seller_peek_request_queue(...)` is authenticated-only.
- `authorize_response_peek_upload(...)` is installed.
- `promote_approved_tour(uuid)` publishes Response Peeks independently.
- `tour-upload-intent` version 13 dispatches between Main and Response authorization.
- `seller_unbound_response_peeks()`, `response_peek_request_candidates(uuid)` and the extended `bind_response_peek(...)` are installed and anonymous execution is denied.
- Staging currently has no approved pending Peek Requests, so a complete live response cycle awaits a real buyer request and seller upload.

## Still required to close Phase 5

1. Replace the listing-detail `window.prompt` decline interaction with the same focus-managed dialog used in the seller queue.
2. Run browser, keyboard, screen-reader and mobile acceptance.
3. Exercise one complete hosted lifecycle with a real buyer request, seller Response Peek upload, moderation approval, binding, notification and playback.

## Verification

Repository verification includes:

- `tests/peekThreadUiContracts.test.mjs`
- `tests/peekThreadReadContracts.test.mjs`
- `tests/peekThreadWriteContracts.test.mjs`
- `tests/responsePeekPlaybackContracts.test.mjs`
- `tests/peekThreadSellerQueueContracts.test.mjs`
- `tests/responsePeekUploadContracts.test.mjs`
- `tests/responsePeekBindingContracts.test.mjs`
- `tests/peekThreadServiceIntegrationContracts.test.mjs`
