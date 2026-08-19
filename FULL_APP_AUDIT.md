# PeekaListing — full repository audit

**Audit base:** `main` @ `28540ca`
**Branch:** `claude/background-push-audit-xa0508` (the branch this session is designated to push to; the
Web Push fixes from the previous audit are its only delta from `28540ca`, and everything below was
assessed against `28540ca` content)
**Scope:** the whole repository — 340 JS/JSX modules (38k lines), 201 migrations (40k lines of SQL),
31 Supabase Edge Functions, 2 Cloudflare workers, 25 workflows, 176 test files, 66 scripts.

---

## Verdict

The security engineering here is **well above average for a marketplace at this stage**. RLS is on all
100 public tables; all 210 `SECURITY DEFINER` functions pin `search_path`; privileged columns are
protected by triggers *and* withheld grants; storage uploads are path-confined and intent-validated;
listing coordinates are reduced to area centroids by a trigger the client cannot override; CI pins every
action to a SHA; there are no XSS sinks, no dynamic SQL, and no dependency vulnerabilities.

The weaknesses are not in the security model. They are in **the mechanisms meant to tell you the system
is healthy**: a release gate that measures a fifth of the payload it exists to bound, a test suite that
mostly reads source code as text rather than running it, an abuse limiter that nothing calls, and no
error monitoring of any kind. Each looks like coverage and is not.

| # | Finding | Severity |
|---|---|---|
| 1 | Build budget gate measures 148 KB while the real critical path is 724 KB — and would fail its own budget | **High** |
| 2 | 83% of test assertions match source text rather than behaviour; 154/176 files never execute app code | **High** |
| 3 | Anonymous, unlimited view-count inflation on listings and Peeks | **High** |
| 4 | The shared abuse rate limiter is built, granted, tested — and called by nothing | **Medium** |
| 5 | No error monitoring anywhere, and the CSP has no reporting endpoint | **Medium** |
| 6 | 30-minute cache with no refetch on focus or reconnect, in an offline-capable marketplace | **Medium** |
| 7 | Transactional email defaults to a hardcoded staging URL | **Medium** |
| 8 | The OAuth popup path is unreachable — `noopener` makes `window.open` return `null` | **Medium** |
| 9 | Admin is locked to one founder email hash with no delegation or documented recovery | **Medium** |
| 10 | No focus management or route announcement on client-side navigation | **Medium** |
| 11 | 140/201 migrations have no explicit transaction; rollback coverage is 60% | **Low** |
| 12 | `/share-image/` can open-redirect via legacy external photo URLs | **Low** |
| 13 | 118 definer functions use `search_path = public` rather than `''` | **Low** |
| 14 | Assorted hardening and polish items | **Low** |

Findings 1–3 are the ones I would act on first. Note that finding 2 is the reason the Web Push defects in
the previous audit survived: 969 tests passed while every notification click went to the wrong page.

---

## 1. The build budget gate measures a fifth of the payload — High

`scripts/verify-build-budget.mjs` reports:

```
Production build budget: PASS (index-B6J5pcog.js 147851 B raw / 48137 B gzip)
```

The real initial critical path is three chunks, resolved serially:

```
index-B6J5pcog.js       raw= 147851   gzip= 48045
App-Cn-Ruowv.js         raw= 305694   gzip= 91180     <- not measured
BrandLogo-DFfofUL1.js   raw= 270231   gzip= 73806     <- not measured (contains the Supabase SDK)
------------------------------------------------------
TOTAL                   raw= 723776   gzip=213031
```

Against the gate's own configured budgets — `entryRawBytes: 560 KiB`, `entryGzipBytes: 170 KiB` — the
real payload **fails both** (724 KB > 560 KB, 213 KB > 170 KB). The gate passes only because it never
sees two-thirds of the bytes.

**Why the gate misses them.** It measures the entry chunk plus every `modulepreload` sibling, and its
comment explains the reasoning: *"Measuring the entry chunk alone would let a regression pass simply by
relocating code into a preloaded sibling."* The logic is right, but the built `index.html` contains
**zero** `modulepreload` links, because `src/main.jsx:39` imports `App.jsx` dynamically. Vite therefore
emits no preload hints, the sibling set is empty, and the guard degrades to exactly the entry-chunk-only
measurement it was written to prevent.

The team already knows the true figure — `vite.config.js:66-70` documents the initial payload as
"589 KB raw / 173 KB gzip" while rejecting a vendor-chunk split. The gate simply is not measuring it.

There is a second cost beyond the number: because the chunks are discovered rather than preloaded, the
browser cannot start fetching `App` until `index` parses, or `BrandLogo` until `App` parses. That is a
three-round-trip serial waterfall before first render — the thing `modulepreload` exists to remove.

**Fix.** Walk the static import graph from the entry chunk (Rollup's bundle metadata, or a regex over
`import ... from "./chunk.js"` in the emitted chunks) and measure the transitive closure, not just
declared preloads. Then either bring the total under budget or re-baseline the budget deliberately. Adding
`modulepreload` hints for the two chunks would also collapse the waterfall.

## 2. The test suite mostly reads source code as text — High

```
assert.match / doesNotMatch (source-text assertions): 4535   (83%)
assert.equal / deepEqual / ok / throws (value):        898   (17%)

tests that read app source as text: 154 / 176 files
tests that import app modules:       33 / 176 files
```

Most "contracts" assert that a file *contains a substring*, not that the code *does the right thing*.
Entire files are pure text matching — `stagingMigrationLedgerReconciliation` (159 text / 0 value),
`listingPublicationJourneyContracts` (81 / 0), `canonicalTaxonomyFoundation` (81 / 0).

This is not hypothetical. In the previous audit, `webPushContracts.test.mjs` asserted
`assert.match(worker, /addEventListener\('push'/)` and passed — while the shipped worker registered
**two** push handlers and sent every notification click to `/notifications` instead of the deep link.
969 tests were green across a completely broken user-facing feature. The six behavioural tests added in
`tests/webPushWorkerRouting.test.mjs` all failed on `28540ca`; they execute the worker instead of reading it.

Text assertions are not worthless — they pin security invariants like "this file must not contain
`WEB_PUSH_PRIVATE_KEY`", which is exactly the right tool. The problem is using them for *behaviour*, where
they encode the current implementation's spelling rather than its contract, so they fail on harmless
refactors and pass through real breakage.

**Fix.** Not a rewrite. For each user-facing subsystem, add one behavioural test that runs the code —
the worker simulation pattern in `tests/webPushWorkerRouting.test.mjs` works for anything with a
well-defined input and output, needs no browser, and runs in ~100 ms. Keep the text assertions for
security invariants and boundary rules, where they belong.

## 3. Anonymous, unlimited view-count inflation — High

Two RPCs are granted to `anon` and both increment publicly displayed counters with no effective limit.

**`record_marketplace_view(p_parent_type, p_parent_id)`** — no dedup, no rate limit, no viewer identity.
Every call does `set views = coalesce(views,0) + 1`. It attempts to exclude the owner:

```sql
and (v_viewer_id is null or seller_id <> v_viewer_id)
```

but `v_viewer_id := auth.uid()`, so an owner who **signs out** satisfies `v_viewer_id is null` and the
update proceeds. The owner-exclusion is bypassed by logging out.

**`record_public_tour_view(p_tour_id, p_viewer_key)`** — dedups on
`(tour_id, viewer_key, viewed_on)`, but `p_viewer_key` is supplied by the client:
`src/hooks/useImmediatePeekView.js:8-14` generates a UUID and keeps it in local storage. An attacker
rotates the UUID per request and every insert is unique.

Consequences: view counts and popularity signals are trivially manipulable by anyone, authenticated or
not; the recommendation and "popular" surfaces consume them; and `tour_view_events` grows without bound
from unauthenticated traffic.

**Fix.** Derive the dedup subject server-side rather than trusting the client, and put both RPCs behind
the token bucket described in finding 4. Making the owner-exclusion depend on something other than a
nullable `auth.uid()` closes the sign-out bypass.

## 4. The abuse rate limiter is never called — Medium

`private.abuse_rate_limit_buckets` and `private.consume_abuse_rate_limit` /
`private.require_abuse_rate_limit` are a genuinely good piece of work: an atomic token bucket, a SHA-256
subject digest so no raw identifiers are stored, capacity and refill constraints, expiry-indexed pruning,
RLS, and revoked grants.

**Nothing in the codebase calls them.** Across all migrations, edge functions and `src/`, the only
references outside their own definition and rollback files are in
`supabase/tests/v1_abuse_rate_limit_buckets.sql` — the limiter's own unit test.

What *is* protected, by bespoke logic: support requests (advisory lock plus 15-minute and 24-hour windows
in `submit_support_request`), messaging (`assert_message_rate_limit`), and the recommendation services
(`consume_recommendation_request_budget_v1`, plus origin allowlist and circuit breaker in
`_shared/recommendation-service.ts` — this surface is well covered).

What is not: the view counters in finding 3, Peek request creation (`create_peek_request` only rejects a
duplicate for the *same subject* within 10 minutes — a user can fan out across unlimited listings), listing
and service creation, media upload intents, and reports.

**Fix.** Wire the existing limiter into those paths. The hard part is already built and tested.

## 5. No error monitoring, and a CSP that cannot report — Medium

There is no Sentry, Datadog, Bugsnag, Rollbar, OpenTelemetry or equivalent anywhere in `package.json` or
`src/`. Production error visibility is six `console.error` calls, which `vite.config.js:53-56` explicitly
identifies as *"the only production error visibility this app has"*.

The CSP (`public/_headers`) is otherwise strong — no `script-src 'unsafe-inline'`, `object-src 'none'`,
`frame-ancestors 'none'`, `base-uri 'self'` — but carries neither `report-uri` nor `report-to`. So CSP
violations, which are the signal that something is injecting into your pages, are also invisible.

The two compound: a JS exception in a lazily-loaded route on a user's phone produces no evidence anywhere
you can see. For a marketplace handling listings and payments-adjacent flows, that is the largest
production-readiness gap in the repository.

**Fix.** Add a CSP reporting endpoint first — it is one header and needs no client code. Then add browser
error reporting; the existing `AppErrorBoundary` and `main.jsx` bootstrap are already the right hooks.

## 6. A 30-minute cache that never refreshes on focus or reconnect — Medium

`src/lib/query-client.js`:

```js
staleTime: 1000 * 60 * 30,   // 30 minutes
gcTime:    1000 * 60 * 60,
refetchOnWindowFocus: false,
refetchOnReconnect: false,
retry: 1,
```

In an installed PWA people background and resume constantly. With these defaults, a resumed session serves
data up to 30 minutes old and will not refresh it on focus; coming back from offline does not refresh it
either. For a marketplace that means stale prices, listings that have since sold, and saved items that no
longer exist — with no way for the user to force a refresh short of a hard reload.

Realtime covers only two surfaces (`ForegroundNotificationListener`, `RealtimeConversationThread`), so
messages and notifications stay live. Listings, search, saved items, Peek requests, and business profiles
do not.

**Fix.** `refetchOnReconnect: true` globally — a PWA regaining connectivity should never keep serving
offline-era data. Then set `staleTime` per query family rather than globally: seconds for inboxes and
listing detail, minutes for search results, 30 minutes for taxonomy and reference data.

## 7. Transactional email defaults to a staging URL — Medium

`supabase/functions/transactional-email-dispatch/index.ts:13`:

```js
const base = (Deno.env.get("FINDIT_APP_URL") ?? "https://staging.peekalisting.pages.dev").replace(/\/$/,"");
```

If `FINDIT_APP_URL` is unset or misspelled in an environment, every CTA and "Manage email notifications"
link in every outgoing email points at staging. The function returns 200 and the failure is invisible.

This is the same shape as the Web Push VAPID gap in the previous audit: removing a hardcoded fallback is
correct, but a hardcoded fallback that silently *substitutes the wrong environment* is worse than none.

**Fix.** Return 503 `email_not_configured` when `FINDIT_APP_URL` is absent, exactly as the function already
does for a missing `RESEND_API_KEY`.

Two smaller notes on the same file. The Resend integration itself is well built — constant-time token
comparison, HTML escaping on every interpolation, same-origin link validation, an `Idempotency-Key` per
job, and retryable/terminal failure classification. But the entire handler and renderer are two single
lines of ~4,000 and ~3,000 characters. A security-relevant, PII-handling path should be reviewable in a
diff; this one cannot be.

## 8. The OAuth popup path is unreachable — Medium

`src/services/authService.js:412-417`:

```js
popup = window.open('about:blank', 'peekalisting-oauth',
  'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes,noopener,noreferrer');
```

Per the HTML specification, `noopener` in the features string makes `window.open` return **`null`** — and
Chrome, Firefox and Safari all implement this. `popup` is therefore always `null` on desktop, the guard at
line 442 (`if (!popup || popup.closed)`) always takes the full-window redirect, and the popup branch never
runs.

Nothing is broken for users: the full-window fallback works. But the desktop UX the code was written to
provide never happens, and a substantial amount of machinery is dead — `createOAuthBridgeId`,
`waitForOAuthBridge`, `postOAuthBridgeMessage`, `oauthBridgeChannelName`, `buildOAuthCallbackUrl` and the
whole BroadcastChannel bridge, roughly 150 lines that cannot execute and cannot be tested by use.

**Fix.** Decide which behaviour you want. To keep the popup, drop `noopener,noreferrer` from the features
string — the bridge already validates `event.origin` and the message envelope, so the opener reference is
handled. To drop the popup, delete the bridge and keep the full-window flow.

On the bridge itself, if you keep it: it passes `access_token` **and `refresh_token`** through
`postMessage` and `BroadcastChannel`. Both are same-origin-bounded and the origin check at
`authService.js:305` is correct, so this needs XSS to exploit — at which point the tokens are reachable
anyway. Worth knowing, not worth blocking on.

## 9. Admin is one email hash, with no delegation or recovery — Medium

`private.is_admin()` requires all of: `role = 'admin'`, `super_admin = true`, MFA assurance, and

```sql
(public.is_founder_identity(user_record.email) or session_user = 'postgres')
```

where `is_founder_identity` compares the SHA-256 of the email against a single hardcoded hash
(`0030_v1_founder_admin_lock.sql`). That same migration demotes every other admin to `role = 'user'`.

The UI is honest about it — `AdminUsers.jsx` labels the filter "Founder admin" — so this is intentional,
not a bug. The risks are operational: no second administrator can be appointed without a migration; if the
founder account is lost or its MFA device is destroyed, the only remaining path is `session_user = 'postgres'`,
i.e. direct database access; and every moderation action in a growing marketplace funnels through one person.

Requiring MFA for admin is genuinely good and worth keeping.

**Fix.** Not urgent, but decide before launch: either document the `postgres` break-glass procedure and
who holds those credentials, or introduce a founder-grantable admin role so moderation can be delegated
without a schema change.

## 10. No focus management on route change — Medium

`AppLayout.jsx` has the right pieces: a "Skip to main content" link and `<main id="main-content" tabIndex={-1}>`.
But nothing focuses `#main-content` when the route changes, and there is no live region announcing
navigation. `document.title` is updated (`src/lib/documentMetadata.js:20`), which some screen readers
announce and others do not.

Across the whole app there is exactly **one** `focus()` call. Radix handles focus inside dialogs, so the
gap is specifically client-side navigation: a keyboard or screen-reader user who activates a link stays
focused on the old element in a page that has silently replaced itself.

The rest of the accessibility posture is decent — 208 `aria-label`s, 78 `role`s, 12 live regions,
`prefers-reduced-motion` honoured in two stylesheets and in `motionTokens.js`, a skip link, and contract
tests enforcing `type` on buttons and `alt` on images.

**Fix.** On location change, move focus to the `<main>` element and announce the new page title in a
polite live region. About 15 lines in `AppLayout`.

## 11. Migration transaction and rollback coverage — Low

**140 of 201 migrations** have no explicit `begin;` / `commit;`, including 17 recent timestamped ones
(`20260809130000_seller_profile_details.sql`, `20260808203000_supabase_runtime_boundary_repairs.sql`,
and others). The newer convention is to wrap them; it is applied inconsistently. Supabase applies each
migration in a transaction, so this is mostly a consistency issue rather than a live hazard — but the
files that mix DDL with data backfills are the ones where a partial apply would hurt most.

**Rollback coverage is 120 of 201** (60%). Worth knowing which 81 migrations cannot be reversed before
you need to reverse one.

## 12. `/share-image/` can open-redirect — Low

`functions/_middleware.js:193-206` serves `/share-image/{kind}/{uuid}` as a 302 to
`safeHttpsUrl(photo) || signStoragePhoto(...)`, where `photo` is `photos[0]` from the listing row.
`safeHttpsUrl` accepts **any** `https:` URL, so a row whose first photo is an external URL turns a
`peekalisting.com` link into a redirect to an arbitrary host — the classic phishing primitive.

In practice the current write path cannot produce this: `listings` grants only `SELECT` to `anon` and
`authenticated` (no INSERT/UPDATE), and media attachment requires a matching `listing_upload_intents` row,
so photos are storage paths. The external-URL branches (`safeLegacyUrl`,
`has_legacy_media` in `listingCreationService.js`) exist for legacy Base44 rows. So this is reachable only
if such rows still exist in the database — which I could not check from here.

There is no SSRF: the middleware returns a redirect, it does not fetch the target.

**Fix.** Restrict the 302 target to the Supabase storage host instead of any HTTPS URL. One line, and it
closes the question permanently.

Related, and worth confirming against live data: `metadataImage` puts the same value in `og:image`, so a
legacy external URL would let a third party see the IP of everyone who previews a shared link.

## 13. `search_path = public` on definer functions — Low

118 of 210 `SECURITY DEFINER` functions in `public` set `search_path = public` rather than `''`. Because
`pg_temp` is implicitly searched first for relations when it is not listed explicitly, this is the standard
setup for temp-table shadowing.

**I checked for exploitability and found none.** Every one of the 124 definer functions without `pg_temp`
pinned schema-qualifies all of its table references; cross-referencing unqualified identifiers against the
100 real table names returns zero matches (the apparent hits are all CTE names, plpgsql variables, and
parameters). This is a hardening item, not a vulnerability.

**Fix.** Standardise on `set search_path = ''` with fully-qualified references, which 91 functions already
use, so the invariant is enforced by the setting rather than by every author remembering to qualify.

## 14. Smaller items — Low

- **`connect-src https://*.supabase.co`** allows any Supabase project, not just `bwgklpxoetrrkutottdb`.
  Pinning the project ref costs nothing and makes exfiltration to another Supabase project impossible.
- **MapTiler key.** `VITE_MAPTILER_PUBLIC_KEY` is correctly a public browser key, but it must be
  domain-restricted in the MapTiler dashboard or anyone can spend your quota. Configuration, not code.
- **`marketplace_operational_controls`** is publicly readable (correctly — it is feature-flag data), but
  `configuration jsonb` is free-form. Nothing sensitive is in it today; worth a comment saying it is
  world-readable so nobody puts anything there later.
- **Dead RLS policies.** `listings_owner_write` and `listings_owner_update` exist but no INSERT/UPDATE
  grant does, so they can never be exercised. The fail-closed result is right; the policies imply a write
  path that does not exist.
- **PWA manifest** declares no `screenshots`, so Android and desktop show the minimal install prompt
  rather than the rich one. Three icons and four shortcuts are present.
- **`caniuse-lite` is 6 months stale**, which affects browser-target accuracy in the build.
- **`changePassword`** re-authenticates with `signInWithPassword`, so a mistyped current password consumes
  an auth rate-limit attempt against the user's own account.

---

## Verified as sound

Recorded so these are not re-audited. Each was checked, not assumed.

**Database**
- RLS enabled on **all 100** public tables; zero exceptions.
- All **210** `SECURITY DEFINER` functions pin `search_path`; zero unpinned.
- Final policy state (replayed across all 201 migrations in order, honouring drops) is **121 policies**,
  of which only **4** are unrestricted — all public reference data (country configs, exchange rates,
  category counts, operational controls). Earlier permissive policies on `reviews`, `seller_ratings`,
  `business_profiles` and `practitioner_reviews` were dropped and hardened in `0013_v1_rls_hardening.sql`.
- **37 tables** have RLS on and no policy at all — deny-all to browser roles, reachable only through
  definer RPCs. That is the correct fail-closed pattern, and it includes every queue and internal table.
- **Privilege escalation is blocked twice over**: `protect_user_managed_fields` raises on any self-edit of
  `role`, `super_admin`, `status`, `email`, `verified`, or ban fields, *and* no UPDATE grant on
  `public.users` exists for `authenticated` at all.
- **Contact-reveal boundary**: raw `contact_phone` / `contact_email` / `contact_whatsapp` are revoked from
  `anon`, replaced by `has_contact_*` booleans, with reveals audited in `contact_reveal_events`.
- **Location privacy**: raw `latitude`/`longitude` are not in the anon column grant. A `BEFORE INSERT OR
  UPDATE` trigger overwrites `public_latitude`/`public_longitude` from the resolved area centroid, so a
  client cannot publish exact coordinates even by writing the column directly.
- **No dynamic SQL** (`EXECUTE format`) in any anon- or authenticated-reachable function.
- **Search is injection-safe**: `websearch_to_tsquery` plus `ilike` with an escaped term and an explicit
  `ESCAPE E'\\'`.
- No surviving `EXECUTE` grant to `PUBLIC` on any function in `public` or `private`; a migration asserts this.

**Storage**
- `tour-playback` and `tour-thumbnails` are private with 300-second signed URLs; source uploads are
  MIME- and size-limited (`video/mp4`, 250 MB).
- Uploads are confined to `(storage.foldername(name))[1] = auth.uid()` **and** require a matching
  upload-intent row. No UPDATE policy exists on `storage.objects` for any bucket, so objects cannot be
  overwritten.
- Read access to listing images is gated on listing status or a real relationship (saved listing, or a
  conversation the requester participates in).

**Edge Functions**
- `verify_jwt` is set deliberately per function with a written rationale for each `false`; the four
  functions with no entry inherit the platform default of `true`.
- Internal endpoints use constant-time secret comparison rather than JWTs.
- `_shared/request-guards.ts` bounds request bodies by **bytes actually read**, not the declared
  `content-length` — a chunked request cannot bypass it. The comment records that this was a real bug.
- Recommendation services enforce an origin allowlist, a durable circuit breaker, and a per-request budget.
- `tour-playback-access` is intentionally unauthenticated; eligibility is enforced inside
  `public_response_peek_metadata` (`status='published' and moderation_status='approved'`).

**Frontend**
- **Zero** `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` across 340 modules.
- No secrets in client source; the build's own `verify-bundle-secrets` gate inspects 171 artefacts and
  confirms no source maps ship.
- No PostgREST filter injection — no `.or()` or template-built filter strings anywhere.
- `ProtectedRoute` re-verifies role against the database rather than React state, and distinguishes
  "permission service unavailable" (retryable) from "denied" — a distinction most implementations miss.
- Supabase auth uses PKCE.

**CI and dependencies**
- **All 25 workflows** declare `permissions:`; **every** action is pinned to a full commit SHA.
- `npm audit`: **0 vulnerabilities**, production and dev.
- Baseline at this commit: `lint` clean, `tsc` clean, `typecheck:active` passes 322 modules,
  **969/969 tests pass**, build passes all five gates.

---

## Method and limits

Findings were verified by execution or by replaying migration state, not by reading in isolation:
policies and grants were replayed in filename order honouring intervening drops and revokes (the naive
concatenated view is misleading — it shows `reviews` as world-readable when it was hardened three
migrations later); definer-function risk was cross-referenced against real table names before being
reported; bundle figures were measured from a real `npm run build`.

**Not covered.** No live database was inspected, so I cannot say whether legacy rows with external photo
URLs still exist (finding 12), nor whether GitHub environment variables such as
`FINDIT_WEB_PUSH_WORKERS_ENABLED`, `VITE_WEB_PUSH_PUBLIC_KEY` and `FINDIT_APP_URL` are actually set.
Nothing was run against a browser, so accessibility findings are static-analysis only — no screen-reader,
contrast, or keyboard-trap testing. DNS and Cloudflare account configuration are not in the repository and
were not audited; only the deployment workflows and `_headers`/`_redirects` were. I did not read the ~20
prior audit documents in the repo root, so some findings here may already be known and deferred.
