# Background Web Push — audit of `main` @ `28540ca`

**Audit base:** `main` @ `28540ca` (merge of #97, "Enable staging background Web Push delivery")
**Editing branch:** `claude/background-push-audit-xa0508`
**Target environment:** Cloudflare staging deployed from `main` (`staging.peekalisting.com`)
**Scope:** the end-to-end background delivery path — alert enqueue → queue/lease → Edge dispatcher → browser
service worker → notification click, plus the client subscription lifecycle and the staging delivery pipeline.

---

## Summary

The delivery *infrastructure* is sound. The queue uses `FOR UPDATE SKIP LOCKED` with lease tokens and
bounded exponential backoff, the dispatcher RPCs are service-role only, permanent failures (404/410)
correctly disable subscriptions, and no private VAPID material reaches the browser bundle. Concurrent
dispatchers are safe by construction.

The *last mile* was broken. Every background notification click landed on `/notifications` instead of the
chat, listing or Peek it referred to, and the worker rendered each push twice. Both defects were invisible
to the existing test suite, which greps sources for expected substrings rather than exercising behaviour.

Four defects are fixed on this branch. Five further findings are documented as recommendations — they need
product or infrastructure decisions rather than a code change, or reach beyond the audited path.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Notification clicks always route to `/notifications`, never the deep link | **Critical** | Fixed |
| 2 | Two `push` and two `notificationclick` handlers in one worker scope | **High** | Fixed |
| 3 | Push cannot be switched off once the remembered VAPID key is lost | **High** | Fixed |
| 4 | `VITE_WEB_PUSH_PUBLIC_KEY` unset ships a silently push-less build | **Medium** | Guard added |
| 5 | `pushsubscriptionchange` is a no-op; rotated endpoints are never re-registered | **Medium** | Recommendation |
| 6 | Delivery cadence depends on GitHub `schedule`, which throttles and auto-disables | **Medium** | Recommendation |
| 7 | Settings panel can hang on an infinite skeleton when no worker registers | **Medium** | Recommendation |
| 8 | Second account on a shared device fails to enable push on first attempt | **Low** | Recommendation |
| 9 | `web_push_event_enabled` fails open for unknown event types | **Low** | Recommendation |
| 10 | Empty fan-out recorded as delivered; background badging not wired | Low | Recommendation |

---

## Fixed

### 1. Notification clicks always routed to `/notifications` — Critical

`public/sw.js` applied its link sanitiser twice. The `push` handler stored an already-**resolved absolute
href** in the notification's `data.link`:

```js
data: { notificationId, link: safeAppUrl(link), type: ... }
```

`safeAppUrl()` accepts only a candidate that `startsWith('/')`. At click time it ran again over that
absolute `https://staging.peekalisting.com/chats/…` value, which does not start with `/`, so it rejected the
app's own URL and fell back to `/notifications`.

Every background push was affected — new messages, listing approvals, Peek activity, business updates.
The notification itself rendered correctly, so the failure only appeared on tap. Executing the worker
against the exact payload `supabase/functions/web-push-dispatch/index.ts` emits confirms it:

```
intended deep link        : /chats/22222222-2222-4222-8222-222222222222
navigate() on click       : https://staging.peekalisting.com/notifications
```

**Fix.** Split the sanitiser into `safeAppPath()` (validate → scope-relative path) and `safeAppUrl()`
(path → absolute href). Notifications now carry the *path*, so the click re-validates it and resolves once.
`safeAppPath()` also accepts an absolute **same-origin** href, so notifications already sitting in a user's
tray from the current build still deep link after the update instead of falling back.

The same-origin boundary is unchanged — cross-origin, protocol-relative and `javascript:` links still fall
back to `/notifications`.

### 2. Two push handlers in a single worker scope — High

`scripts/stamp-service-worker.mjs` prepends `importScripts('/push-sw.js')` to `dist/sw.js`, so both files
run in **one** `ServiceWorkerGlobalScope`. Both registered a `push` listener and both registered a
`notificationclick` listener. Every delivery therefore called `showNotification` twice and every tap ran two
competing routing handlers.

Duplicate notifications were masked only because the dispatcher happens to send a `tag`, so the second
notification replaced the first. That masking is incidental: any payload without a `tag` produces two
visible notifications, because `push-sw.js` fell back to `tag: undefined` while `sw.js` fell back to
`'peekalisting-update'`.

The click path was worse. The surviving notification came from `sw.js` and carried `data.link`, but
`push-sw.js`'s click handler read `data.url` — a key `sw.js` never sets — so it unconditionally navigated to
`/notifications` and raced the correct handler.

`push-sw.js` was also the weaker implementation: no scope-aware URL resolution and no same-origin
re-validation on click.

**Fix.** `public/push-sw.js` is now solely the subscription lifecycle script (staging `skipWaiting`,
`pushsubscriptionchange`). Push rendering and click routing belong to `public/sw.js` alone, and a comment
in each file records why the split must hold. The build pipeline is untouched.

Nothing user-visible was lost: the `setAppBadge` branch removed with the old handler keyed off a
`badgeCount` field the dispatcher has never sent (see finding 10).

### 3. Push could not be switched off once the remembered key was lost — High

`getCurrentPushSubscription()` reported a live subscription as absent whenever the VAPID key recorded in
local storage did not match the configured one — including when nothing was recorded at all.
`disableWebPush()` was built on that filtered view:

```js
const subscription = await getCurrentPushSubscription();
if (!subscription) return;   // silent no-op
```

So whenever the stored key was missing — storage cleared, evicted under pressure, or a write that failed
silently, since `writeStoredString` returns `false` rather than throwing — the user got:

- Settings showing push as **off** while the browser subscription stayed live and the row stayed
  `enabled = true`;
- a disable toggle that reported success and did nothing, so **notifications kept arriving with no way to
  stop them**;
- a fresh unsubscribe/subscribe cycle on every subsequent enable, accumulating dead rows.

The consent failure is the serious part: a user who turns notifications off must actually stop receiving
them.

**Fix.** The browser, not local storage, is now the authority. `subscriptionUsesCurrentKey()` reads
`PushSubscription.options.applicationServerKey` and compares it to the configured key; the remembered value
is only a fallback for engines that do not expose it, and an *absent* record no longer means "stale" — it
means "cannot tell", which must not hide a live subscription. `disableWebPush()` now tears down whatever the
browser actually holds. Verified that the browser's key buffer round-trips to exactly the configured
base64url string and that a rotated key compares unequal.

### 4. An unset VAPID key ships a silently push-less staging build — Medium

Commit `576f8d4` removed the hardcoded `STAGING_PUBLIC_VAPID_KEY` fallback — correct — but added no
replacement guard. `VITE_WEB_PUSH_PUBLIC_KEY` is referenced nowhere in `scripts/validate-env.mjs`,
`verify-deployment-security.mjs` or `verify-cloudflare-staging.mjs`. If the repository variable is unset or
misspelled, the deploy goes green and ships a build where Settings reads "Push delivery is not configured
for this deployment yet" — the one message nobody watching a deploy log would see.

**Fix.** The staging deploy's verification step now emits a GitHub `::warning::` when the variable is empty.

It is deliberately a warning, not a hard failure: I cannot see whether the variable is currently set in the
`cloudflare-staging` environment, and a fatal check would break staging deploys on `main` immediately.
**Once you have confirmed the variable is set, change the `::warning::` to `::error::` + `exit 1`** so the
condition can never ship silently again.

---

## Recommendations (not implemented)

### 5. `pushsubscriptionchange` never re-registers the endpoint — Medium

The handler posts `PUSH_SUBSCRIPTION_CHANGED` to open windows, and **nothing in `src/` listens for that
message** — the only occurrences in the repository are the two lines that send it. Worse, this event
normally fires with no window open, so the message reaches nobody.

When a browser rotates a subscription, the new endpoint is never registered and the old one is never
disabled. Background delivery stops permanently for that device and the queue keeps attempting the dead
endpoint until it 410s. Recovery requires the user to notice and manually toggle push off and on.

**Suggested fix:** re-subscribe inside the handler using `event.oldSubscription`'s key so the browser keeps
a valid endpoint, persist a "needs re-registration" marker, and have the app call
`register_web_push_subscription` on next load. The worker cannot call the RPC itself — it has no user JWT —
so the client half is required. Worth pairing with a startup re-registration call, which would make
subscription state self-healing and is cheap.

### 6. Delivery cadence rests on GitHub `schedule` — Medium

Both dispatch workflows use `cron: '*/5 * * * *'`. GitHub does not honour that interval under load —
scheduled runs are routinely delayed 15–30+ minutes — and **scheduled workflows are disabled automatically
after 60 days without repository activity**, which would take background push down completely and silently.

For chat message notifications, a 30-minute tail makes the feature worse than useless. Consider driving
`web-push-dispatch` from `pg_cron` + `pg_net` inside Supabase (1-minute cadence, no external scheduler,
fires in the same system that owns the queue), keeping the workflow as a manual `workflow_dispatch`
fallback.

### 7. Settings can hang on an infinite skeleton — Medium

`PushNotificationSettings` awaits `getCurrentPushSubscription()`, which awaits `navigator.serviceWorker.ready`.
That promise never resolves *and never rejects* when no worker is registered — and `registerServiceWorker()`
returns `null` on preview deployments and swallows registration failures. `webPushSupport()` checks that the
API exists, not that a registration does, so `initializing` stays `true` and the panel renders
`ListRowsSkeleton` forever.

**Suggested fix:** race `navigator.serviceWorker.ready` against `getRegistration()`/a timeout and treat the
unresolved case as "unsupported on this deployment".

### 8. Second account on a shared device fails to enable push — Low

`private.register_web_push_subscription` raises `42501 'push subscription belongs to another account'` when
an endpoint is already owned by a different user. On a shared browser the endpoint is stable across
accounts, so user B's first enable throws — surfacing that raw message as a toast — and the `catch`
unsubscribes. A second attempt succeeds, because the subscription is now gone and a fresh one is created.

Meanwhile user A's row stays `enabled = true` against an endpoint the browser has discarded, so it takes
delivery attempts until it 410s.

**Suggested fix:** on that specific error, unsubscribe and re-subscribe once automatically, and disable the
prior owner's row. At minimum, map the error to a user-readable message.

### 9. `web_push_event_enabled` fails open — Low

The `case` ends `else true`, so any event type not explicitly listed is pushable and ungated by any user
preference. New event types silently bypass the five categories in Settings until someone remembers to add
them. Failing closed (`else false`) for unrecognised types, with `account_status` staying essential, makes
the omission visible in staging instead of shipping unwanted notifications.

Related: `is_safe_notification_link` matches only UUID versions 1–5 (`[1-5][0-9a-f]{3}`). Current IDs are
v4, so this is fine today, but a future move to UUIDv7 would silently downgrade every deep link to
`/notifications` — precisely the failure mode of finding 1.

### 10. Observability gaps — Low

- A job with **zero active subscriptions is recorded as `delivered`** (`complete = subscriptions.length === 0
  || delivered > 0`). Defensible — the in-app alert is canonical and retrying an empty fan-out gains
  nothing — but it means delivery metrics overstate reality. A distinct `skipped` status would keep the
  queue semantics and make the number honest.
- App badging is not wired for background push: `sw.js` never calls `setAppBadge`, and the dispatcher never
  sends a count. Badge updates happen only in the foreground listener.

---

## Verified as correct

Worth recording, so these are not re-audited:

- **No private VAPID material in the browser bundle.** `WEB_PUSH_PRIVATE_KEY` is read only inside the Edge
  function from `Deno.env`.
- **Dispatcher authorisation.** Non-POST rejected; `x-push-dispatch-token` compared against a required
  server-side secret; missing config returns 503 rather than proceeding.
- **RPC privilege boundary.** `claim_web_push_deliveries`, `complete_web_push_delivery` and
  `record_web_push_subscription_result` are revoked from `public`/`anon`/`authenticated` and granted only to
  `service_role`. `register_`/`disable_web_push_subscription` are `authenticated`-only and scoped by
  `auth.uid()`.
- **Queue concurrency.** `FOR UPDATE SKIP LOCKED` plus a `lease_token` that `complete_web_push_delivery`
  matches (`where id = … and lease_token = … and status = 'processing'`) means two dispatchers cannot double
  send or clobber each other's completion. The staging and production workflows are safe to run
  concurrently.
- **Retry policy.** Attempts increment on claim; expired leases are reclaimed; backoff is
  `15 × 2^(attempts-1)` capped at 1 hour; `attempts >= 5` terminates as `failed`.
- **Permanent-failure handling.** 404/410 disables the subscription rather than retrying it forever.
- **Payload privacy.** Message pushes carry "You have a new message in PeekaListing." and never message
  content; control characters are stripped and lengths bounded on both sides.
- **Link validation is defence-in-depth.** Enforced in the database (`is_safe_notification_link`), again in
  the dispatcher (`safeLink`), and again in the worker.
- **Staging worker registration is not blocked.** `VITE_DEPLOY_ENV: staging` and
  `VITE_PREVIEW_DEPLOYMENT: "false"` mean `previewDeployment()` is false, so the worker registers.
  `updateViaCache: 'none'` ensures both `sw.js` and the imported `push-sw.js` bypass the HTTP cache on
  update checks.
- **Deep-link routes exist.** `/chats/:conversationId` and `/notifications` are both routed.

---

## Verification

`tests/webPushWorkerRouting.test.mjs` is new. It loads `push-sw.js` and `sw.js` into a single simulated
worker scope — the same composition the build produces — and asserts behaviour rather than source text:
handler counts, the payload the dispatcher actually emits, the resulting notification, and where a click
navigates for six link shapes including hostile ones.

All six tests **fail on `main` @ `28540ca`** and pass on this branch:

```
### against unfixed main@28540ca ###
not ok 1 - the stamped worker registers exactly one push and one click handler
not ok 2 - push subscription lifecycle script never duplicates push rendering or routing
not ok 3 - a delivered push shows one notification carrying a re-validatable link
not ok 4 - clicking a delivered notification opens the deep link, not the fallback
not ok 5 - click routing stays same-origin and falls back safely
not ok 6 - a malformed push payload still shows one user-visible notification
# pass 0  # fail 6
```

Full suite: **964 passing**. The single remaining failure, `tests/auditRemediationContracts.test.mjs`, is
environmental — it imports `typescript`, which is absent because dependencies are not installed in this
container — and fails identically on unmodified `28540ca`.

Two existing contracts required updating, both because they asserted the duplicated structure this audit
removed:

- `comprehensiveProductAudit.test.mjs` forbids storage identifiers outside the storage helper; a comment of
  mine tripped it. Reworded — the rule is right.
- `peekaListingBrandContracts.test.mjs` asserted the branded push fallbacks live in `push-sw.js`. Retargeted
  to `sw.js`, which now owns rendering, and tightened to assert `push-sw.js` renders nothing — so the two
  files cannot drift back together.

### Not verified here

No push was delivered to a real device from this container. Before closing this out, on staging: enable
notifications on an installed PWA, send a chat message from a second account, background the app, and
confirm **one** notification arrives and tapping it opens the conversation rather than `/notifications`.
