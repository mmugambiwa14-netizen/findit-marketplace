# Peek Threads Phase 5 — UI integration handoff

Status: buyer-facing asset listing integration and explicit Response Peek playback complete; seller queue and Response Peek upload binding remain open.

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
- Static UI and playback contracts covering terminology, category use, role separation, identity and storage-path exclusion.

## Preserved boundaries

- The component calls Phase 3/4 services; it does not query Supabase directly.
- It does not create a second video table, upload route, storage path or moderation system.
- Response Peek cards receive only the public read model.
- Raw storage paths and playback URLs are not rendered by the thread API.
- Main Listing Peek playback remains unchanged and parent-addressed.
- Response playback is explicit by `tourId` and succeeds only when the Peek is current public evidence for an approved answered request.

## Hosted staging state

- `public_response_peek_metadata(uuid)` is installed in the staging database.
- `tour-playback-access` version 13 accepts either the existing parent target or an explicit Response Peek identity.
- There are currently no published Response Peeks bound to answered requests in staging, so the authorization boundary is deployed but cannot yet be exercised with live response media.

## Still required to complete Phase 5

1. Add the seller-wide Buyer Peek Requests queue with ranking from `sellerQueueScore`.
2. Extend the existing Peek uploader intent with `peek_kind = response` and parent/request binding context.
3. Add the post-upload “Which requests does this answer?” selection step.
4. Integrate the shared section into Service detail once the service page’s stacked listing-shell work is reconciled.
5. Replace the temporary decline prompt with the repository’s focus-managed dialog primitive.
6. Run browser, keyboard, screen-reader and mobile acceptance.

## Verification

Repository verification consists of:

- `tests/peekThreadUiContracts.test.mjs`
- `tests/peekThreadReadContracts.test.mjs`
- `tests/peekThreadWriteContracts.test.mjs`
- `tests/responsePeekPlaybackContracts.test.mjs`

Live staging confirms the database function and Edge Function deployment. End-to-end Response Peek playback still requires the first moderated Response Peek to be uploaded and bound.
