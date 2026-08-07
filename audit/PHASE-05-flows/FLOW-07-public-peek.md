# FLOW-07 — Public Peek (discovery, playback, privacy, failure)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/peek` → `Tours.jsx` when `featureFlags.tours`, else `ToursPlaceholder.jsx`; route exists only when `tours || toursPreview` (`App.jsx:171`).
Playback: `listingToursService` → `supabase/functions/tour-playback-access/index.ts:58-62` → **signed URLs** from the private buckets `tour-playback` (250 MB, `video/mp4`) and `tour-thumbnails` (5 MB, `image/webp`), returned via `browserReachableUrl(req, …)` (`:88`).
Publication predicate: `status = 'ready' and moderation_status = 'approved' and deleted_at is null` (`0033:515`).

## Assessment
| Aspect | State |
|---|---|
| Bucket privacy | PASS — both buckets are `public = false`; access only via signed URL |
| CSP | PASS — `media-src 'self' blob: https://*.supabase.co` matches the live delivery path (`vercel.json:17`) |
| Failed media not exposed | PASS — the publication predicate requires `status='ready'` |
| Memory discipline | `Tours.jsx:245` documents keeping only current/previous/next Peek resident and pausing on background |
| **Production availability** | **FAIL — F-003.** Route absent unless `VITE_FEATURE_TOURS=true`, which no production path sets |

## Gaps
- **F-003 (P1)** — the core differentiator is not reachable in production.
- Peek `moderation_status` is set to `'approved'` by the processing pipeline for Peeks (distinct from the peek_requests default hazard in F-026); auto-publication holds.
- Dead UI: `ImmersivePeekCard`, `TourCard`, `TourCatalogueHeader`, `TourCategoryChips` are orphaned (**F-010**).
