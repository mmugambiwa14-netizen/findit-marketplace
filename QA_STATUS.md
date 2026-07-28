# QA Status

## Milestone 7 release candidate — 2026-07-27

| Area | Status | Evidence |
|---|---|---|
| Complete repository contracts | Passed | 215/215 |
| Tour contracts | Passed | 97/97 |
| Static source boundary | Passed | 308 modules parsed; zero unresolved local imports |
| Messaging scale | Passed by contract | Keyset inbox/thread pages, bounded sizes, deterministic cursors and authorization smokes |
| Public search scale | Passed by contract | Keyset newest/price pages, normalized search document and hot-path indexes |
| Notification scale | Passed by contract | Owner keyset pages, leased bounded fan-out, idempotency, retry/dead-letter and retention |
| Tours scale | Passed by contract | Eligible-feed cursor index and multi-page traversal boundary |
| Operational telemetry | Passed by contract | Aggregate hourly metrics, founder health, deterministic alerts, privacy and retention |
| Release controls | Passed | Closed and accepted production environment validation; named staging acceptance required |
| Repository hygiene | Passed | 497 text files inspected; no emoji/pictographic symbols, merge markers or high-confidence committed secrets |
| SQL migration boundary | Passed | 42 contiguous migrations; 13 rollback capsules; safe `0040`–`0042` rollback boundary |
| Base44/configuration hygiene | Passed | Base44 elimination plus JSON, workflow YAML and Supabase configuration validation |
| Locked install/lint/typecheck/build/audit | Blocked in packaging environment | `npm ci --ignore-scripts` failed with registry HTTP 503; CI must rerun the locked gates |
| PostgreSQL migrations/live scale smokes | Pending authorized runtime | Apply through `0042` and run guarded hosted suites |
| Browser/device/accessibility acceptance | Pending deployed staging | Safari, Chrome, keyboard, screen reader, reduced motion, low bandwidth and playback failures |
| Rollback rehearsal | Pending authorized staging | Reverse order `0042`, `0041`, `0040`; preserve evidence and canonical data |

The repository implementation is a release candidate. Production certification requires the guarded hosted and real-device gates above.

## Historical pre-Tours checkpoint — 2026-07-26
| Area | Status | Evidence |
|---|---|---|
| Clean install/lockfile | Passed locally | Locked npm install and reduced dependency tree |
| Lint | Passed | `npm run lint` |
| Full typecheck | Passed | `npm run typecheck` |
| Migration/active typechecks | Passed | 29 migration modules, 15 repositories, 170 active modules |
| Contract tests | Passed | 88/88 |
| Production build | Passed | Base44 elimination and built-output scans; bundle budgets passed |
| Production dependency audit | Passed with bounded exception | No reachable Moderate/High/Critical advisory; React Router RSC-only advisory documented |
| Hosted migrations/lint | Passed | Migrations `0001`–`0030` deployed; `public,storage` lint clean and no migration pending |
| Hosted Auth | Passed for implemented path | Confirmed fixture, profile trigger, password login, own-profile RLS, anonymous denial, logout, cleanup |
| Owner listings/favourites | Passed hosted API | Read, save/remove, edit/re-review, bypass denial, delete/cascade |
| Public services | Passed hosted API/Storage | Browse plus owner create/edit/pause/delete and trusted media |
| Business/dealer profiles | Passed hosted API/Storage | One-owner rule, public projection, inventory search, signed logo, suspension hiding |
| Admin | Passed hosted API | Authorization, overview, listings, users, reports, support, categories, audit; exactly one active founder admin after migration `0030` |
| Listing creation/media | Passed hosted HTTP | Origin/content denial, sanitization, private upload, moderation, exact-byte signed read, replacement, cleanup |
| Messaging | Passed hosted API | Participant isolation, thread/inbox, unread, plain text, block/report, rate limit |
| Notifications | Passed hosted API | Five event classes, trusted creation, safe links, read state, isolation |
| Media cleanup worker | Passed hosted HTTP | Browser denial, dedicated secret, two-bucket cleanup, finalization, idempotency |
| Listing expiry worker | Passed hosted HTTP | Browser denial, dedicated secret, trusted notice, safe link, idempotency |
| Search scale | Passed hosted API | 130 fixtures, exact counts, stable six-page traversal, detail/price filters |
| Feature flags | Passed build/config | Three MVP flags on in staging workflow; all deferred flags off |
| Accessibility semantics | Passed source contracts | Skip link, landmarks, active-page state, notification live states |
| Local responsive browser QA | Passed for changed surfaces | Home, Google option, compact guest/favourites prompt, and Privacy page inspected at 1440×900 and 390×844 |
| Hosted browser/device matrix | Blocked | No deployed frontend URL; OAuth consent/callback smoke passed but full deep-link, browser and screen-reader coverage remains |
| SMTP confirmation/recovery | Blocked | 13 templates pass repository contracts, but Supabase free-tier default mail provider rejected hosted template publication; custom SMTP or plan upgrade is required |
| OAuth | Google staging passed; Apple deferred | Supabase reports Google enabled and Apple disabled; real Google consent/callback created one Auth user with provider `google`; public Google audience and deployed-frontend regression remain |
| Native recovery/PITR | Blocked | Provider plan/owner decision; logical backup hashes pass |

The staging backend is accepted. Production QA is not complete until a frontend
host exists and the browser/device, SMTP, public Google audience, monitoring,
and native recovery checks are run. Apple is intentionally outside the current
release scope.
## Tours Milestone 6 local checkpoint — 2026-07-27

| Area | Status | Evidence |
|---|---|---|
| Tour reporting/admin contracts | Passed | 78/78 Tour contracts; 173/173 complete repository contracts |
| Static source boundary | Passed | 292 modules parsed; zero unresolved local imports |
| Tour report identity | Passed by contract | Durable target identity, canonical parent retained, legacy deleted-parent fallback |
| Tour-only admin decisions | Passed by contract | Action/dismiss paths cannot delete listing/service parents |
| Admin review-media security | Passed by contract | JWT-required Edge Function, admin-only RPC, derived assets only, no source path |
| Repository/config hygiene | Passed | Base44 gate, 18 JSON, 3 workflow YAML, secret scan, closed-Tours env validation |
| Production dependency audit | Passed | No reachable Moderate/High/Critical advisory |
| Locked install/lint/typecheck/build | Blocked in packaging environment | Registry unavailable/stalled and local npm cache empty |
| PostgreSQL migration/live moderation smoke | Pending authorized runtime | Run `test:tours-moderation-local` and guarded hosted equivalent |
| Browser/device moderation acceptance | Pending deployed staging | Validate reporting, queue, playback expiry, removal/restore, accessibility and mobile layouts |

