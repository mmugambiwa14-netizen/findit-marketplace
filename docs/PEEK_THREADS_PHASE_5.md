# Peek Threads Phase 5 — UI integration handoff

Status: buyer-facing integration, explicit Response Peek playback, seller-wide request queue and Response Peek upload path complete; post-moderation request selection and binding remain open.

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
- Existing `TourUploader` extended with explicit `peekKind="response"` mode.
- Response uploads reuse `tour-sources`, signed upload intents, upload completion, processing and moderation.
- Response authorization bypasses the single Main Peek slot and cannot replace the hero Peek.
- Approved Response Peeks publish independently through `promote_approved_tour`.
- Seller queue Record response action opens the existing uploader in a focus-managed dialog.
- Static UI, playback, seller-queue and upload contracts.

## Preserved boundaries

- Components call service and repository boundaries; they do not query Supabase directly.
- No second video table, upload bucket, processing worker, moderation system or seller identity system was created.
- Main Listing Peek upload calls default to `peekKind = main` and retain slot replacement semantics.
- Response Peek upload requires an owned public parent with at least one approved pending buyer request.
- Uploading or approval alone does not mark any request answered.
- Request binding and buyer notification remain explicit later operations.
- Raw storage paths and playback URLs are not rendered by the thread API.

## Hosted staging state

- `public_response_peek_metadata(uuid)` is installed.
- `tour-playback-access` version 13 supports Main and explicit Response Peek playback.
- `seller_peek_request_queue(...)` is installed and executable only by authenticated users.
- `authorize_response_peek_upload(...)` is installed.
- `promote_approved_tour(uuid)` publishes approved Response Peeks without touching `listing_tour_slots`.
- `tour-upload-intent` version 13 dispatches explicitly between Main and Response authorization.
- Staging currently contains no approved pending Peek Requests, so a live Response upload is correctly rejected until a real request exists.

## Still required to complete Phase 5

1. Add the post-moderation “Which requests does this answer?” selection step.
2. Persist a seller’s intended request selection while media is processing, or present the selector once the Response Peek becomes approved.
3. Bind the approved Response Peek to one or more compatible requests and trigger deduplicated notifications.
4. Integrate the shared section into Service detail once the service page’s stacked listing-shell work is reconciled.
5. Replace the listing-detail temporary decline prompt with the same focus-managed dialog primitive used by the seller queue.
6. Add a natural seller-dashboard navigation entry for `/peek-requests` while preserving the compact mobile layout.
7. Run browser, keyboard, screen-reader and mobile acceptance.

## Verification

Repository verification consists of:

- `tests/peekThreadUiContracts.test.mjs`
- `tests/peekThreadReadContracts.test.mjs`
- `tests/peekThreadWriteContracts.test.mjs`
- `tests/responsePeekPlaybackContracts.test.mjs`
- `tests/peekThreadSellerQueueContracts.test.mjs`
- `tests/responsePeekUploadContracts.test.mjs`

Live staging confirms the playback authorization, seller queue, Response upload authorization, independent promotion path and Edge Function dispatch. End-to-end Response Peek publication still requires a real pending request, moderation completion and explicit request binding.
