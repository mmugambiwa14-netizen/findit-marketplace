# Milestone 6 / F — Tour Reporting and Administration

## Completed boundary

Milestone 6 extends the existing marketplace reporting and founder-admin system
to moderate Tours without creating a second admin application or allowing a
video decision to delete its canonical listing or service.

Implemented:

- Public Tour reporting from both catalogue cards and listing-detail playback.
- Eight deterministic video-specific reasons: unrelated video, misleading
  representation, stolen content, unsafe content, inappropriate content,
  prohibited watermark, suspected fraud, and duplicate content.
- Durable `target_type` and `target_id` report identity while retaining the
  canonical `listing_id` or `service_id` relationship.
- Legacy-report backfill that remains migration-safe even when an old parent
  item was already deleted.
- A Tour-safe `admin_review_report` branch: actioning removes only the Tour;
  dismissing restores only an eligible ready Tour; marking reviewed changes no
  public content.
- An expanded founder moderation queue covering pending, reported, failed,
  rejected, approved, and all Tours, with parent state, seller state, failure
  context, report context, and rejected-Tour history.
- Short-lived signed review playback and thumbnails through
  `tour-admin-review-access`, protected by platform JWT verification and an
  admin-only database RPC. Original source video is never exposed.
- Manual Approve, Reject, Restore, Remove Tour, View parent, and Suspend seller
  controls inside the existing Safety and moderation admin page.
- Reason-gated decisions, audit records, reporter resolution notifications,
  report rate limits, and cache invalidation after public state changes.
- Migration `0039_v1_tour_reporting_and_admin.sql`, targeted rollback,
  11 Milestone 6 contracts, and guarded local/hosted moderation smoke commands.

## Security and identity boundary

- A Tour report always points to the Tour and its canonical parent.
- Browser insert privileges are not widened to direct Tour relationship writes;
  public reports continue through `report_tour()`.
- Non-admin users cannot call the review metadata RPC or obtain signed review
  media.
- Admin review responses contain derived playback/thumbnail URLs only, never
  private source paths.
- Removing a Tour does not delete or unpublish its listing/service.
- Repeat-offender suspension is manual, reasoned, and audited. No external AI
  moderation or automated account suspension is introduced.
- Reports, canonical parents, Tours, users, and audit evidence are preserved by
  rollback.

## Verification

Dependency-independent gates completed:

```bash
npm run test:tours-contracts
npm run test:contracts
npm run verify:base44-elimination
npm run validate:env
npm run audit:production
```

Results:

- Tour contracts: 78/78 passed.
- Complete repository contracts: 173/173 passed.
- Static syntax/import verification: 292 modules, zero failures.
- Base44 elimination: passed.
- Development and production environment validation: passed with Tours closed.
- Repository JSON: 18/18 parsed.
- Workflow YAML: 3/3 parsed.
- High-confidence secret scan: zero matches.
- Production dependency audit: no reachable Moderate, High, or Critical
  advisories.

Authorized local Supabase acceptance:

```bash
npm run test:tours-moderation-local
```

Authorized hosted staging acceptance:

```bash
FINDIT_ALLOW_HOSTED_TESTS=true \
FINDIT_EXPECTED_PROJECT_REF=<exact-staging-ref> \
npm run test:tours-moderation-hosted
```

A locked dependency install could not complete in the packaging environment
because the configured package registry stalled or was unavailable and the
local npm cache was empty. Installed lint, project typechecks, migration
execution, browser/device acceptance, and live Supabase smoke remain deployment
gates rather than claimed passes.

## Staging activation order

1. Back up the confirmed staging database and record the current frontend and
   Edge Function deployments.
2. Apply migrations `0031` through `0039` in order.
3. Deploy `tour-admin-review-access` with JWT verification enabled.
4. Keep browser and backend Tours disabled while running all prior Tour smokes
   plus `test:tours-moderation-hosted`.
5. Verify a reported Tour immediately leaves public discovery and playback.
6. Verify admin review media is short-lived, derived-only, and denied to a
   normal authenticated user.
7. Verify dismissal restores an eligible Tour and actioning removes only the
   Tour while its canonical parent remains intact.
8. Verify every decision and manual seller suspension appears in audit history.
9. Enable Tours in staging only after the complete upload, processing,
   integration, catalogue, lifecycle, moderation, mobile, and observability
   acceptance boundary passes.

## Rollback

1. Set `VITE_FEATURE_TOURS=false` and disable backend Tour publication.
2. Undeploy `tour-admin-review-access` if necessary.
3. Apply `supabase/rollback/0039_v1_tour_reporting_and_admin.rollback.sql`
   only to the confirmed target.
4. Preserve reports, Tours, media, canonical parents, and audit history.

The targeted rollback restores the earlier Tour queue and removes the private
review-media RPC. It deliberately retains durable report identity and the
Tour-safe report decision path because removing those protections would
reintroduce the known parent-listing deletion defect.
