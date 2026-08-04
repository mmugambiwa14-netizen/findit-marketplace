# Peek Threads Phase 5 — UI integration handoff

Status: buyer-facing asset listing integration complete; seller queue and Response Peek playback/upload binding remain open.

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
- Static UI contracts covering terminology, category use, role separation and storage-path exclusion.

## Preserved boundaries

- The component calls Phase 3/4 services; it does not query Supabase directly.
- It does not create a new video player, upload route, storage path or moderation system.
- Response Peek cards receive only the public read model.
- Raw storage paths and playback URLs are not rendered.
- Main Listing Peek playback remains unchanged.

## Deliberately not claimed complete

The “Watch Peek” and “Record response” controls remain disabled until the existing playback and upload paths accept an explicit Response Peek identity without accidentally resolving the Main Listing Peek slot. Enabling them before that boundary exists would risk playing or replacing the wrong video.

Still required to complete Phase 5:

1. Extend explicit playback authorization to a published approved Response Peek ID.
2. Add the seller-wide Buyer Peek Requests queue with ranking from `sellerQueueScore`.
3. Extend the existing Peek uploader intent with `peek_kind = response` and parent/request binding context.
4. Add the post-upload “Which requests does this answer?” selection step.
5. Integrate the shared section into Service detail once the service page’s stacked listing-shell work is reconciled.
6. Replace the temporary decline prompt with the repository’s focus-managed dialog primitive.
7. Run browser, keyboard, screen-reader and mobile acceptance.

## Verification

Repository-only verification currently consists of `tests/peekThreadUiContracts.test.mjs` plus the existing read/write contract suites. No live Supabase, browser or device execution is claimed from this environment.
