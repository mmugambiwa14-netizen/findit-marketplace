# PeekaListing — signed-in and admin audit

**Audit base:** `main` @ `28540ca`
**Method:** the app was built and driven in headless Chromium **with an authenticated session**, against a
stub Supabase backend that answers PostgREST, RPC and `/auth/v1` with representative fixtures. A session
was seeded into browser storage for a founder/admin account, which carried the app through its real
gates — `getCurrentUser()` → profile read → MFA assurance check → `ProtectedRoute` role verification via
the `is_admin` RPC. 42 route×viewport loads (21 routes × 390 px and 1280 px), plus scripted interaction
runs against the admin console and member surfaces.

This closes the gap left by the previous UI audit, which ran signed out and therefore never rendered
`/profile`, `/settings`, `/my-listings`, `/chats`, `/notifications` or any of the ten admin routes.

---

## Verdict

**The admin console is the best-built part of this application.** Every one of the ten sections navigates,
the dashboard renders live counts, moderation actions open a confirmation dialog that *requires a written
reason* before firing, filters and search work, pagination correctly disables both controls on a single
page of results, and there were zero JavaScript errors across the entire run. The "narrow, auditable
action" promise in the dashboard copy is actually implemented.

There is one serious problem, and it is the same problem in six places: **on a phone, every admin table
hides most of its columns and all of its action buttons behind a horizontal scroll with no affordance.**
An admin on mobile cannot moderate.

On the member side the surfaces all render cleanly; the defects are touch-target and truncation issues.

| # | Finding | Severity | Where |
|---|---|---|---|
| 1 | Every admin table hides most columns **and all row actions** on mobile | **High** | all six admin tables |
| 2 | Settings toggles are 36×20 px with no row fallback | **Medium** | `PushNotificationSettings`, `Settings` |
| 3 | `/profile` menu descriptions hard-truncate mid-word | **Low** | `src/pages/Profile.jsx` |
| 4 | Bottom-nav "Discover" clipping recurs on every signed-in page | **Low** | carried from previous audit |
| 5 | Sign-out is labelled "Log out" for members and "Sign out" for admins | **Low** | `Profile.jsx` / `AdminSidebarCollapsible.jsx` |

---

## 1. Admin moderation is effectively desktop-only — High

At 390 px every admin table renders far wider than its scroll container, so the columns an admin needs and
the buttons they act with are simply not on screen. Measured:

| route | table width | scroller | columns hidden | row controls off-screen |
|---|---|---|---|---|
| `/admin/listings` | 880 px | 356 px | **4 of 7** — Owner, Status, Reports, **Actions** | **6 of 9** (Pause, Remove ×3) |
| `/admin/users` | 900 px | 356 px | **5 of 7** — Adverts, Role, Status, Joined, **Actions** | 2 of 4 |
| `/admin/peeks` | 1040 px | 356 px | **5 of 6** — Owner, Processing, Reports, Created, **Actions** | 2 of 3 |
| `/admin/support` | 900 px | 356 px | **5 of 6** — Customer, Category, Status, Received, **Action** | 1 of 1 |
| `/admin/categories` | 980 px | 316 px | **7 of 9** — Current slug, Type, Postable, Adverts, Markets, State, **Action** | — |
| `/admin/audit-log` | 900 px | 356 px | **5 of 6** — Admin, Action, Target, Reason, Correlation | — |

At 1280 px every table fits exactly (`/admin/listings` is 974 px in a 974 px scroller) and nothing is
hidden, so this is purely a small-viewport failure.

The screenshot of `/admin/listings` at 390 px shows the whole visible table: three columns — Advert, Type,
Price — and then the pagination. **Nothing on screen indicates there is more to the right.** There is no
scroll shadow, no fade, no "swipe for more" hint. An admin opening the moderation queue on a phone sees
adverts they cannot act on, and no reason to believe an action exists.

This matters more than a typical responsive issue because of finding 9 in the repository audit: admin is
locked to a **single founder identity**. There is exactly one person who can moderate this marketplace,
and on their phone the moderation controls are invisible.

**Fix.** The cheapest correct change is a scroll affordance — a right-edge gradient plus
`aria-describedby` text — which at least tells the admin the columns exist. The better change is a card
layout below `sm`: one card per row with the fields stacked and the actions as full-width buttons, which
is the pattern the member-side lists already use. Sticking the first column (`position: sticky; left: 0`)
would also help, so the admin keeps track of which row they have scrolled to.

## 2. Settings toggles are a 20 px tap target — Medium

The push-category switches on `/settings` measure **36×20 px**. Every one is correctly labelled
(`aria-label="Messages push notifications"` and so on), so this is not a naming problem — it is hit area.
20 px is roughly 3 mm on a phone, against a 44 px (≈9 mm) minimum in both WCAG 2.5.5 and the Apple HIG.

I tested whether the surrounding row compensates, using network requests rather than visual state:

```
tap row label (120 px left of switch):  0 update request(s)  -> row NOT tappable
tap 10 px below the switch:             0 update request(s)  -> MISSES
tap the switch itself:                  1 update request(s)  -> works
```

So the switch is the only target, a near-miss does nothing, and the generous row of text next to it is
inert. `/settings` carries 21 sub-44 px controls in total, the most of any page in the app.

**Fix.** Wrap each row in a `<label>` so the text and the whole row toggle the switch. That fixes hit area
and pointer affordance in one change without altering the visual design. Keep the `aria-label`s.

## 3. `/profile` menu descriptions truncate mid-word — Low

Three descriptions on the profile menu are cut off with an ellipsis:

```
"Record visual answers buyers wan…"      needs 252 px, has 244 px
"Terms, privacy, cookies and comm…"      needs 271 px, has 244 px
"Moderation, users and marketplac…"      needs 265 px, has 244 px
```

Computed style is `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` — the Tailwind
`truncate` utility. That is the right tool for a title that must stay on one line, but these are
explanatory subtitles whose whole job is to tell the user what the menu item does, and all three lose
their last words by 8–27 px.

**Fix.** `line-clamp-2` instead of `truncate` on the description line.

## 4. and 5. Carried-over and cosmetic — Low

- The bottom-nav **"Discover" label is clipped on every signed-in page too** (needs 77 px, has 64 px),
  confirming the previous audit's finding applies app-wide rather than only to public pages.
- **Sign-out is labelled two different ways**: members get "Log out" (`Profile.jsx:67`), admins get
  "Sign out" (`AdminSidebarCollapsible.jsx:55`). Same action, same session, two words. Worth picking one.

---

## Verified working

Exercised in the browser with a real session, not read from source.

**Authentication path**
- The full gate chain passes end to end: session read → `users` profile load → MFA assurance check →
  `ProtectedRoute` role verification. No step short-circuits or hangs.
- `ProtectedRoute` re-verifies the admin role against the `is_admin` RPC rather than trusting the profile
  in React state — confirmed by observing the call on every admin route entry.
- The authenticated header renders the notification bell and unread badges (Chats 1, alerts 2) that are
  absent when signed out.

**Admin console — all ten sections**
- Every sidebar link navigates to its section: `/admin`, `/admin/listings`, `/admin/business-applications`,
  `/admin/managed-listings`, `/admin/peeks`, `/admin/users`, `/admin/reports`, `/admin/support`,
  `/admin/categories`, `/admin/audit-log`. No dead entries.
- The dashboard renders live counts from `admin_dashboard_stats` (Active listings 3, Active services 1,
  Users 42, Pending reports 2) and each overview card links to its section.
- **Moderation is gated behind a confirmation dialog that requires a reason.** Clicking "Pause" on a
  listing opens a dialog containing a text field rather than firing the action immediately — which is
  what makes the audit log meaningful.
- Filters and search work on `/admin/users` (2 filter controls plus a text search) with no errors.
- **Pagination is correct**: with a single page of results both "Previous" and "Next" are `disabled`, and
  the page indicator reads "Page 1". No off-by-one, no dead controls.
- Every admin page has exactly one `<h1>`.

**Member surfaces**
- All eleven render without error at both viewports: `/profile`, `/settings`, `/saved`, `/my-listings`,
  `/my-services`, `/peek-requests`, `/chats`, `/notifications`, `/post`, `/create-service`,
  `/business-profiles`.
- `/notifications` renders the alert list and offers "mark all read".
- `/chats` renders the inbox with the conversation, counterparty and last message.
- `/saved` renders favourites grouped by category with counts.
- `/profile` exposes eleven account links, including `/admin` — which appears only because this session
  holds the admin role.
- Push settings **correctly degrade**: with `VITE_WEB_PUSH_PUBLIC_KEY` unset this build shows "Push
  delivery is not configured for this deployment yet" and disables the enable button. That is the
  intended fallback — and a live demonstration of finding 4 in the repository audit, where an unset
  variable ships a silently push-less build with no build-time warning.

**Stability**
- **Zero JavaScript errors, zero unhandled page errors and zero 4xx responses** across all 42
  route×viewport loads and every interaction run, member and admin alike. (Realtime WebSocket failures
  were excluded — the stub does not implement realtime.)

---

## Method and limits

The session was seeded directly into browser storage rather than obtained through a password or OAuth
flow, because no real staging credentials were used and none should be. Everything downstream of that
seed is the application's genuine code path, including the MFA gate and the server-side role check.

**What this cannot tell you.** The backend was a stub, so **no server-side authorization was actually
enforced** — `is_admin` returned `true` because the stub said so. This run therefore validates the admin
console's *client* behaviour only; whether the database would actually permit these actions is a separate
question, answered in the repository audit (which found the RLS, grant and trigger boundaries sound, and
`is_admin` locked to a single founder identity with MFA required).

Also untested: any flow needing real data or storage — listing creation and media upload, message sending,
Peek playback, map tiles, and the moderation actions' actual effects, all of which were confirmed to open
their dialogs but not to complete. Only Chromium was exercised, so no Safari or Firefox layout differences
would have surfaced, and iOS standalone PWA behaviour is untested. Colour contrast was not measured.
Admin pages were driven with one to three rows per table; a table with 50 rows may reveal pagination,
virtualisation or performance issues this run could not.
