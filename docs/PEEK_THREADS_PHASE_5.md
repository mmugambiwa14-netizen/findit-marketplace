# Peek Threads Phase 5 — UI integration handoff

Status: buyer-facing integration, explicit Response Peek playback and seller-wide request queue complete; Response Peek upload and binding remain open.

## Delivered

- Shared `PeekThreadsSection` component.
- Public thread filters: Top requests, Answered, Awaiting response and Newest.
- Structured request composer using the existing category registry.
- Suggested prompts by listing kind.
- Duplicate detection before creation with support-instead behaviour.
- “I want this too” support action.
- Owner-aware decline action.
- Loading, error and empty states.
- Integration into Property, Vehicle and Machinery detail pages.
- Explicit public Response Peek playback by approved published Peek ID.
- Separate Main Listing Peek and Response Peek authorization paths inside the existing `tour-playback-access` function.
- Signed private-storage playback with no raw paths exposed to the thread read model.
- Reusable mobile-safe Response Peek player.
- Seller-wide Buyer Peek Requests queue at `/peek-requests`.
- Queue ranking combines supporter demand with bounded waiting age.
- Owner-scoped database authorization for both listing and service requests.
- Stable keyset pagination with a maximum page size of 50.
- Focus-managed decline dialog with a required buyer-facing reason.
- Static UI, playback and seller-queue contracts.

## Preserved boundaries

- Components call service and repository boundaries; they do not query Supabase directly.
- No second video table, upload route, storage path, moderation system or seller identity system was created.
- Response Peek cards receive only the public read model.
- Raw storage paths and playback URLs are not rendered by the thread API.
- Main Listing Peek playback remains unchanged and parent-addressed.
- Response playback is explicit by `tourId` and succeeds only when the Peek is current public evidence for an approved answered request.
- The seller queue is derived from existing `peek_requests`, `listings` and `services` records.

## Hosted staging state

- `public_response_peek_metadata(uuid)` is installed.
- `tour-playback-access` version 13 accepts either the existing parent target or an explicit Response Peek identity.
- `seller_peek_request_queue(...)` is installed and executable only by authenticated users.
- There are currently no published Response Peeks bound to answered requests in staging, so live response playback awaits the first completed response upload.

## Still required to complete Phase 5

1. Extend the existing Peek uploader intent with `peek_kind = response` and parent/request binding context.
2. Add the post-upload “Which requests does this answer?” selection step.
3. Connect the seller queue’s Record response action to that uploader flow.
4. Integrate the shared section into Service detail once the service page’s stacked listing-shell work is reconciled.
5. Replace the listing-detail temporary decline prompt with the same focus-managed dialog primitive now used by the seller queue.
6. Add a natural seller-dashboard navigation entry for `/peek-requests` while preserving the current compact mobile layout.
7. Run browser, keyboard, screen-reader and mobile acceptance.

## Verification

Repository verification consists of:

- `tests/peekThreadUiContracts.test.mjs`
- `tests/peekThreadReadContracts.test.mjs`
- `tests/peekThreadWriteContracts.test.mjs`
- `tests/responsePeekPlaybackContracts.test.mjs`
- `tests/peekThreadSellerQueueContracts.test.mjs`

Live staging confirms the playback authorization function, Edge Function deployment and seller queue RPC. End-to-end Response Peek publication still requires uploader support, moderation and request binding.
