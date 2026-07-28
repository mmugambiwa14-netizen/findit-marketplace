# Tours Audit

Tours is a seller-recorded short-video capability layered onto listings and
services. It is the newest subsystem (migrations `0031`–`0044`, milestones 2–7)
and the one the project rules require to stay isolated and feature-flagged.

## Verdict

**Tours is correctly isolated and its two-minute limit is genuinely enforced.**
Disabling the flag does not break any other feature — verified in code, not
assumed.

## Feature-flag isolation

Two independent switches:

| Switch | Location | Scope |
|---|---|---|
| `VITE_FEATURE_TOURS` | `src/lib/featureFlags.js` | Browser |
| `VITE_FEATURE_TOURS_PREVIEW` | same | Placeholder page only |
| `TOURS_BACKEND_ENABLED` | `_shared/tour-runtime.ts:21` | Server, **never `VITE_`-prefixed** |

`scripts/validate-env.mjs:73` enforces the coupling — the browser flag cannot be
enabled unless the backend flag is:

> "Tour browser or preview access cannot be enabled unless TOURS_BACKEND_ENABLED is true"

A third gate, `FINDIT_TOURS_RELEASE_ACCEPTED`, requires a recorded
`FINDIT_TOURS_ACCEPTANCE_ID` before production enablement.

Enforcement is layered rather than route-only:

- `App.jsx:138–139` — `/tours` resolves to the real page, the placeholder, or
  **nothing at all**. There is no reachable broken route.
- `listingToursService.js:31` — throws `Tours are not enabled in this build`.
- `listingToursService.js:254, 272` — read paths return safe empties.
- `TourManagementPanel.jsx:116`, `TourUploader.jsx:79` — render `null`.
- `AdminReports.jsx:51` — admin queue hidden unless `tours || toursPreview`.

## Does disabling Tours break anything?

**No.** Five non-tour services import `attachPublicTourSummaries`:
`publicListingsService`, `favouritesService`, `servicesService`,
`sellerProfilesService`, `businessProfilesService`. Each import is safe because
the function short-circuits:

```js
export async function attachPublicTourSummaries(items, parentType) {
  if (!featureFlags.tours || !Array.isArray(items) || items.length === 0) return items ?? [];
  ...
  } catch {
    // A Tour metadata outage must degrade to the canonical image-only listing.
    return items.map((item) => ({ ...item, tour: null }));
  }
}
```

`tryGetPublicTourPlayback` behaves the same way — returns `null` when the flag
is off and swallows failures so "Tour playback failure must never make the
canonical listing unavailable."

So with Tours off: **Discover, listings, services, chats, posting, profile,
seller pages, business profiles and navigation are unaffected**, and with Tours
on but the backend degraded, listings fall back to image-only rather than
erroring. `tests/comprehensiveProductAudit.test.mjs` additionally asserts that
`publicListingsService` and `servicesService` never call
`getPublicTourPlayback` directly, preventing regression of this boundary.

## Two-minute limit — enforced at five layers

The rule is `120` seconds and it is defended in depth. A client that lies about
duration is rejected server-side; a compromised client cannot persist an
over-length tour.

| Layer | Location | Mechanism |
|---|---|---|
| 1. Browser | `TourUploader.jsx:92` | Reads real `video.duration` from the decoded file, rejects `> TOUR_MAX_DURATION_SECONDS` |
| 2. Edge Function | `tour-upload-intent/index.ts:73` | Rejects non-finite, `<= 0`, or `> TOUR_LIMITS.maxDurationSeconds` |
| 3. DB constraint (intent) | `0032:17–18` | `declared_duration_seconds between 0.001 and 120` |
| 4. DB constraint (tour) | `0031:144` | `duration_seconds is null or between 0.001 and 120` |
| 5. Processing callback | `0033:283` | Rejects measured `p_duration_seconds not between 0.001 and 120` |

Layer 5 matters most: it validates the duration **measured by the processor
after transcode**, so a file whose container metadata understated its length is
still caught.

A sixth guard locks the constant itself — `0031:57` raises unless
`max_duration = 120`, `max_source_bytes = 262144000` and `public_height = 720`,
so the limit cannot be silently relaxed by a later migration.

`TOUR_LIMITS` in `_shared/tour-runtime.ts` is `Object.freeze`d.

## File type and size validation

| Control | Value | Enforced at |
|---|---|---|
| Source MIME | `video/mp4`, `video/quicktime`, `video/webm` | bucket + `TOUR_MIME_EXTENSIONS` + intent RPC |
| Source size | 250 MB (262,144,000 B) | bucket, `TOUR_LIMITS`, DB constraint |
| Playback MIME | `video/mp4` only | `tour-playback` bucket |
| Thumbnail MIME | `image/webp` only | `tour-thumbnails` bucket |
| Request body | 64 KiB | `requireJsonRequest()` |

## Upload authorization and ownership

- `tour-upload-intent` and `tour-upload-complete` are `verify_jwt = true`.
- The intent RPC verifies the caller owns the parent listing/service before
  issuing a signed URL, and the storage policy
  `tour_source_authorized_insert` gates the write against that recorded intent —
  so the signed URL alone is not sufficient.
- The client never chooses a storage key; paths are derived server-side and
  owner-scoped.
- Read policies (`listing_tours_owner_admin_read` and the slot/event/intent
  equivalents) restrict direct table access to owner or admin.

## Lifecycle

Publish, unpublish, edit and delete run through dedicated RPCs with explicit
status validation rather than trigger side effects, keeping the state machine
readable in one place. `listing_tour_slots` enforces the listing↔tour
relationship; `0037_v1_listing_tour_integration.sql` wires navigation both ways.

Deletion enqueues `tour_asset_cleanup_queue`, drained by
`tour-lifecycle-cleanup`, so storage objects do not leak when a row is removed —
and orphan cleanup is idempotent because the queue is keyed per asset.

Deleted or unavailable listings/media degrade to `tour: null` through the
`catch` paths above rather than surfacing a broken player.

## Feed, pagination and delivery

- `tour-feed` (public, `verify_jwt = false`) filters eligibility through a
  service-only RPC, then signs thumbnails and cover images in **one bounded
  batch** — no N+1 signing.
- `Tours.jsx` uses `useInfiniteQuery` with a keyset cursor
  `{ id, publishedAt }`; `listing_tours` carries 7 indexes.
- Playback URLs are signed for 300 s, card assets for 3600 s.
  `ListingMediaViewer` requests playback **only after an explicit Play**, and
  exposes `retryPlayback` with a "playback link expired" path — both asserted by
  the contract suite.
- `tour-cache-invalidation` + `tour_cache_invalidations` support CDN purge when
  `TOUR_CACHE_PURGE_URL` is configured.

## Engagement, reporting, moderation

- `listing_tour_events` records engagement (1 index).
- Reporting flows into the shared `reports` table; `0039` adds tour reporting
  and admin surfaces.
- `AdminTourQueue.jsx` + `admin_tour_queue` / `admin_approve_tour` provide the
  moderation queue, behind the same `is_admin()` guard as all admin RPCs.
- `tour-admin-review-access` is `verify_jwt = true` **and** performs an
  admin-only `SECURITY DEFINER` metadata check before signing any private
  derived asset — reviewers cannot mint URLs for arbitrary tours.

## Provider abstraction

`_shared/tour-provider.ts` isolates the external transcoding provider behind
`TOUR_PROCESSOR_URL` / `TOUR_PROCESSOR_SECRET`, with the callback authenticated
by timestamped HMAC. Swapping providers does not touch schema or UI. Failure and
retry are handled by `tour-processing-worker` claiming jobs with a lease.

## Findings

**T-01 (Low)** — `AdminTourQueue.jsx` produces 5 of the 20 residual typecheck
errors (`Property 'action'/'tour'/'reason' does not exist on type 'void'`) from
`useMutation` variable inference under `checkJs`. Runtime behaviour is correct;
the mutation variables are typed as `void` because no JSDoc generic is supplied.
*Correction:* annotate the `mutationFn` parameter.
*Blocks: nothing.*

**T-02 (Informational)** — Tours ships **disabled by default** in code
(`VITE_FEATURE_TOURS=false`, backend `TOURS_BACKEND_ENABLED=false`) and requires
a recorded acceptance id to enable in production. Enabling it is a deliberate,
gated act — correct, and worth restating so it is not mistaken for an
incomplete feature. *Blocks: nothing.*

**T-03 (Informational)** — Tour scale characteristics (concurrent transcodes,
feed latency under load, CDN behaviour) cannot be evaluated locally. The
`tours-scale-smoke-local` and `tours-observability-smoke-local` scripts exist
but require a running stack. **No claim is made here about the volume Tours can
sustain.** See EXTERNAL_BLOCKERS.md. *Blocks: production — needs measurement.*

## Conclusion

Tours meets every isolation requirement in the project rules. The two-minute
limit is enforced server-side and in the database, not merely in the browser,
and turning the feature off leaves the rest of the product intact.
