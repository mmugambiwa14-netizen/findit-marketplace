# PeekaListing — product, interface and runtime audit

**Audit base:** `main` @ `28540ca`
**Consolidates four audits** run in one session: UI wiring and layout (signed out), signed-in and admin
surfaces, action completeness and UI noise, and accessibility/performance/PWA/SEO/hygiene. Findings are
deduplicated and ranked once, and the correction issued during the session is folded into the finding it
affects rather than left as an appendix.

A separate **repository audit** (`FULL_APP_AUDIT.md`) covers security, database, RLS, Edge Functions, CI
and release engineering, and a **Web Push audit** (`BACKGROUND_PUSH_AUDIT.md`) covers that delivery path.
This document does not repeat them, but references them where a finding here is the visible consequence of
one there.

---

## Method

The application was **built and driven in a real browser** — not read. A stub Supabase backend answered
PostgREST, RPC and `/auth/v1` with representative fixtures so pages rendered real data. Coverage:

| pass | what ran |
|---|---|
| Signed out | 46 route×viewport loads at 360 / 390 / 768 / 1280 px, plus scripted interaction runs |
| Signed in | 42 route×viewport loads across 11 member and 10 admin routes, with a founder/admin session seeded into browser storage — carrying the app through its real gates: profile read → MFA assurance → `ProtectedRoute` role check via the `is_admin` RPC |
| Accessibility | contrast computed for 472 rendered text nodes across 15 routes; 189 tab stops walked; accessibility tree read directly |
| Performance | Web Vitals at 390 px under 4× CPU throttling and ~1.6 Mbps / 150 ms, cold cache, service worker blocked |
| Static | every internal link cross-checked against declared routes; migration bodies parsed for audit-logging calls; grants compared against RPCs the client calls |

---

## Verdict

**The application is well built and the wiring is sound.** Every internal navigation target resolves,
feature-flag gating is consistent, guest gating preserves `returnTo` and prompts rather than failing
silently, and **not a single JavaScript error** appeared across 88 page loads and every interaction
tested. The admin console is the strongest part: moderation requires a written reason before firing,
pagination is correct, and all ten sections work.

Accessibility mechanics are unusually good — no heading-level skips, every `nav` labelled, live regions
throughout, and **all 189 tab stops carry a visible focus ring**.

Three things need attention before launch: **the primary brand colour fails contrast against its own
button label**, **the app takes 6–7 seconds to render on a mid-range phone**, and **an admin cannot
moderate from a phone at all**. Two product gaps also stand out: a seller can never mark a listing sold,
and the admin audit log shows only part of what admins do.

### Findings

| # | Finding | Severity |
|---|---|---|
| 1 | Primary colour fails WCAG AA for its own label — every primary CTA | **High** |
| 2 | LCP 6.3–7.5 s on a mid-range mobile profile | **High** |
| 3 | Every admin table hides most columns **and all row actions** on mobile | **High** |
| 4 | A listing can never be marked sold | **Medium** |
| 5 | The admin audit log shows only part of admin activity | **Medium** |
| 6 | Managed-listing decisions leave no trail at all | **Medium** |
| 7 | The recommendation engine has no admin UI | **Medium** |
| 8 | Retired "FindIt" brand in 54 user-visible strings, 3 read by screen readers | **Medium** |
| 9 | Nine `[TO BE COMPLETED]` placeholders render live in Privacy and Terms | **Medium** |
| 10 | `/services` scrolls sideways on mobile | **Medium** |
| 11 | Bottom-nav "Discover" is clipped at every mobile width | **Medium** |
| 12 | Category tiles clip; three of four at 360 px | **Medium** |
| 13 | `/help/contact` renders zero headings | **Medium** |
| 14 | Settings toggles are a 36×20 px tap target with no row fallback | **Medium** |
| 15 | Touch targets under 44 px: favourite button, legal footer links | Low |
| 16 | Nested `<main>` landmarks on 18 pages | Low |
| 17 | `/profile` menu descriptions hard-truncate mid-word | Low |
| 18 | No sitemap and no structured data anywhere | Low |
| 19 | `/settings` carries seven top-level sections | Low |
| 20 | Inert scaffolding: 16 no-op flags, 7 dormant tables, 6 dead constants | Low |
| 21 | No bulk actions, no export, no admin-initiated deletion | Low |
| 22 | Four status documents give three different contract counts | Low |
| 23 | Sign-out is "Log out" for members, "Sign out" for admins | Low |

---

# High

## 1. The primary colour fails contrast for its own label

Measured on the live button:

```
"Log in"   color rgb(255,255,255)  background rgb(61,145,255)
           16px / weight 600   ->  3.14:1     (WCAG AA needs 4.5:1)
```

16 px at weight 600 is not "large text" (that needs 18.66 px at 700, or 24 px), so 4.5:1 applies. The token
is `--primary: 214 100% 62%` (`src/index.css:85`).

This is not one button. The same white-on-primary pairing fails on **primary CTAs** ("Log in", "Create
account", "Contact seller"), **unread count badges** in the nav across 7 routes, and **status pills** in
the admin tables. The light theme is marginal too: `217 91% 54%` gives **4.44:1**.

Across 15 routes and 472 evaluated text nodes there were **18 contrast failures in 5 distinct styles**;
this family accounts for 17. The remaining one is a timestamp at `rgba(156,168,186,0.7)` scoring 4.39.

**Fix.** Darken the token. Holding hue and saturation, lightness must reach **48%**:

| lightness | colour | ratio |
|---|---|---|
| 62% (current) | rgb(61,145,255) | 3.14 |
| 54% | rgb(20,122,255) | 3.99 |
| 50% | rgb(0,110,255) | 4.49 |
| **48%** | **rgb(0,106,245)** | **4.79** ✓ |

Darkening the label instead usually looks worse on a saturated button. One token fixes every instance.

## 2. LCP is 6.3–7.5 seconds on a mid-range phone

390 px, 4× CPU throttle, ~1.6 Mbps / 150 ms, cold cache, service worker blocked:

| route | FCP | LCP | CLS | requests | transferred |
|---|---|---|---|---|---|
| `/` | 6,948 ms | **7,472 ms** POOR | 0.001 GOOD | 70 | 1,090 KB |
| `/search` | 6,932 ms | **7,356 ms** POOR | 0 GOOD | 66 | 1,064 KB |
| `/services` | 6,328 ms | **6,328 ms** POOR | 0.003 GOOD | 52 | 975 KB |

Google's thresholds are ≤2.5 s good, >4 s poor — every route is poor by roughly 3×. Main-thread blocking
is 277–419 ms across 3–5 long tasks. **CLS is excellent**: whatever is slow, it is not janky.

This is the runtime consequence of finding 1 in the repository audit: the initial payload is three
serially-resolved chunks totalling 724 KB raw / 213 KB gzip, of which the build budget gate measures only
the first (148 KB). A three-hop request waterfall on a throttled connection is exactly a seven-second LCP.

**On the profile:** 4× CPU throttle at 1.6 Mbps approximates a low-to-mid Android on a poor connection.
For a Zimbabwe marketplace that is arguably the *representative* device, not a worst case — and it is why
a desktop-fast build gate never surfaced it.

**Fix.** Measure the transitive static import graph in `verify-build-budget.mjs`, then bring the payload
under the existing 560 KB / 170 KB budget or re-baseline deliberately. Adding `modulepreload` hints for
the two undeclared chunks collapses the waterfall without changing a byte of application code, and is the
cheapest single improvement available.

## 3. Admin moderation is effectively desktop-only

At 390 px every admin table renders far wider than its scroll container, so the columns an admin needs and
the buttons they act with are off screen:

| route | table | scroller | columns hidden | row controls off-screen |
|---|---|---|---|---|
| `/admin/listings` | 880 px | 356 px | **4 of 7** — Owner, Status, Reports, **Actions** | **6 of 9** (Pause, Remove ×3) |
| `/admin/users` | 900 px | 356 px | **5 of 7** — Adverts, Role, Status, Joined, **Actions** | 2 of 4 |
| `/admin/peeks` | 1040 px | 356 px | **5 of 6** — Owner, Processing, Reports, Created, **Actions** | 2 of 3 |
| `/admin/support` | 900 px | 356 px | **5 of 6** — Customer, Category, Status, Received, **Action** | 1 of 1 |
| `/admin/categories` | 980 px | 316 px | **7 of 9** | — |
| `/admin/audit-log` | 900 px | 356 px | **5 of 6** | — |

At 1280 px every table fits exactly and nothing is hidden — this is a small-viewport failure only.

The screenshot of `/admin/listings` at 390 px shows the entire visible table: Advert, Type, Price, then
pagination. **Nothing indicates there is more to the right** — no scroll shadow, no fade, no hint. An
admin opening the moderation queue on a phone sees adverts they cannot act on and no reason to believe an
action exists.

This matters more than a typical responsive issue because of the repository audit's finding on the founder
admin lock: `is_admin()` requires a single founder email hash, so there is exactly one person who can
moderate this marketplace — and on their phone the controls are invisible.

**Fix.** Cheapest: a right-edge gradient plus `aria-describedby` text, so the admin at least knows the
columns exist. Better: a card layout below `sm` — one card per row, fields stacked, actions as full-width
buttons, which is the pattern the member-side lists already use. Sticking the first column
(`position: sticky; left: 0`) also helps the admin keep their place while scrolling.

---

# Medium

## 4. A listing can never be marked sold

`listing_status` declares six states:

```sql
create type listing_status as enum ('draft','available','under_offer','sold','rented','expired');
```

**`'sold'` appears exactly once in the entire 40,000-line schema — that declaration.** No function, trigger
or migration ever sets it. `'rented'` appears only as a *source* state in transition guards, never as a
destination.

What an owner can actually do (`owner_transition_listing`): `submit`, `pause`, `resume`, `unavailable`.

So a seller who sells their car marks it **"unavailable"** — the same state as "withdrawn", "temporarily
off", or "changed my mind". The marketplace never learns a sale happened.

That costs more than tidiness: sold-count is the usual basis for seller trust signals, it is the honest
answer to "is this still available?", and it is the input any future ranking on seller performance would
need. Adding it later means the historical data does not exist.

**Fix.** Add a `sold` action to `owner_transition_listing` (and `rented`, which the enum already
anticipates), and surface it in `MyListings` alongside pause. The enum and the status labels already exist.

## 5. The admin audit log shows only part of admin activity

`/admin/audit-log` reads `admin_audit_rows_page`, which selects `from public.audit_logs`. Admin activity is
actually recorded in **three** places:

| trail | written by | visible at `/admin/audit-log`? |
|---|---|---|
| `public.audit_logs` | 17 admin functions via `record_admin_action` | **yes** |
| `public.business_review_events` | business application + category reviews | **no** |
| `public.recommendation_configuration_audit` | recommendation config changes | **no** |
| *(nothing)* | managed-listing decisions — see finding 6 | n/a |

`business_review_events` is a proper trail — `actor_user_id`, a constrained `action` enum
(`application_rejected`, `category_approved`, `category_suspended`, …), a timestamp. The data is there and
it is good. But **neither it nor `recommendation_configuration_audit` is referenced anywhere in `src/`**,
so neither is readable in the product.

An admin asking "what has been done on this marketplace?" gets an answer that silently omits every
business approval, rejection and category suspension — the decisions most likely to be disputed by the
person on the other end. Nothing on the page indicates the view is partial.

**Fix.** Either union the three sources in `admin_audit_rows_page`, or add tabs for "Moderation",
"Business reviews" and "Configuration". The second is less work and reads better.

## 6. Managed-listing decisions leave no trail

Of 23 mutating `admin_*` functions, 22 record what happened somewhere. `admin_update_managed_listing_request`
does not:

```sql
update public.managed_listing_requests
set status = p_status,
    reviewer_message = nullif(trim(p_message), ''),
    assigned_to = coalesce(p_assigned_to, assigned_to),
    updated_at = now()
where id = p_request_id;
```

No `record_admin_action`, no event row. Nothing records **who** changed the status or **what it was
before**. And because `reviewer_message` is assigned rather than appended, each decision overwrites the
previous reviewer's reasoning as it goes.

This is a commercial decision about whether the marketplace will list on someone's behalf.

**Fix.** Add a `record_admin_action` call, as the other 22 already do. If message history matters, append
to an events table rather than overwriting the column.

## 7. The recommendation engine has no admin UI

Seven admin capabilities exist in the database, are granted to `authenticated`, are audited, and have **no
screen anywhere**:

```
admin_upsert_recommendation_relationship      admin_update_recommendation_service_policy_v1
admin_upsert_recommendation_taxonomy_node     admin_purge_recommendation_service_cache_v1
admin_upsert_recommendation_weight_profile    admin_recommendation_configuration_snapshot
admin_upsert_recommendation_context_rule_v1
```

The `/admin` dashboard *displays* recommendation analytics and then offers no lever to change anything.
Weight profiles, relationship rules, context rules, service policies and cache purging are all SQL-only.

For a marketplace whose discovery surface is driven by this engine, the thing most likely to need tuning
after launch is the thing that cannot be tuned from the product.

**Fix.** Even a read-only configuration screen plus the cache-purge button would help;
`admin_recommendation_configuration_snapshot` already exists to render it.

## 8. The retired brand name is visible in 54 places

54 user-visible occurrences of "FindIt" across 19 files. Three are accessible names a screen reader
announces — confirmed by reading the accessibility tree, not the source:

```
accessible controls on /help/contact:
  { role: "button", name: "Refresh FindIt" }     <-- announced to assistive technology
```

| where | string |
|---|---|
| `AdminSidebarCollapsible.jsx:24` | `aria-label="FindIt admin overview"` |
| `DiscoverSearch.jsx:33` | `aria-label="Search FindIt"` |
| `GlobalRefreshButton.jsx:20,29,30` | toast + `aria-label` + `title` |
| `ProfileHeader.jsx:25` | fallback display name `'FindIt user'` |
| `DeleteAccountSection.jsx:78` | "Delete your **FindIt** account?" |
| `ReportListingDialog.jsx:44` | "…helping keep **FindIt** safe." |
| `LocationPermissionDialog.jsx:24,28` | two paragraphs of privacy copy |
| `create-listing/*` | four files in the listing wizard |
| `public/robots.txt:1` | `# FindIt Marketplace` |

**Why it survived.** `tests/peekaListingBrandContracts.test.mjs` asserts `doesNotMatch(/\bFindIt\b/)` — but
only against a **hardcoded list of ~25 file paths**. All 19 files above are outside that list. The test has
passed on every commit while the retired name ships to users and to assistive technology.

This is the substring-contract weakness from the repository audit in its purest form: a test that looks
like brand protection and actually protects a fixed list of files.

**Fix.** Replace the path list with a glob over `src/**/*.{js,jsx}` plus `public/robots.txt`, excluding the
`findit-` CSS prefix and comments. It will fail immediately, which is the point.

## 9. Nine `[TO BE COMPLETED]` placeholders render live

Read from the rendered pages:

| page | placeholders |
|---|---|
| `/legal/privacy` | **5** — operator legal name, registered address, privacy contact email, transfer mechanism, retention periods |
| `/legal/terms` | **4** — operator legal name, registered address, liability cap, mediation/arbitration step |
| `/legal/data-protection` | **1** — data-processing terms per provider |

The published Privacy Policy currently tells a reader the marketplace is operated by
`[TO BE COMPLETED: operator legal name]` and that data-rights requests go to
`[TO BE COMPLETED: privacy contact email]`.

**In fairness**, every legal page carries a visible banner: *"Review draft: this document provides a
practical launch baseline, not legal advice. Operator details, governing law, retention periods, and
country-specific requirements must be approved before public launch."* The placeholders are deliberate and
flagged — a launch blocker rather than a defect, but the kind that is easy to forget, on the first document
a regulator reads.

**Related, and correct:** an earlier draft of this audit reported that the Data Protection page contradicts
the product by claiming there is no self-service account deletion. **That was wrong.**
`src/lib/legalContentOverrides.js` intercepts the paragraph at render time and the live page accurately
reads *"Self-service account deletion is available in Settings. … Self-service data export is not yet
available and export requests are handled through support."* Data export genuinely does not exist; the
contradiction does not.

## 10. `/services` scrolls sideways on mobile

At 360 px the page overflows by **88 px**; at 390 px by **58 px**. The body itself scrolls horizontally —
not a carousel. Clean at 768 px and 1280 px.

`src/pages/Services.jsx:139-155`:

```jsx
<div className="mb-4 flex items-center justify-between gap-3">
  <div><h2>Results</h2><p>Showing {services.length} service…</p></div>
  <div className="flex items-center gap-2">
    {featureFlags.maps && ( /* List | Map toggle, ~150px */ )}
    <Button asChild variant="outline" className="sm:hidden">
      <Link to="/create-service"><Plus />Offer service</Link>
    </Button>
  </div>
</div>
```

The mobile-only "Offer service" button (`sm:hidden`, so it appears **below** 640 px) shares a
non-wrapping row with the List/Map toggle and the results count. Measured: its right edge lands at
**448 px against a 390 px viewport**, rendering clipped as "Offer se…", with "Showing 1 service" forced
onto two lines by the squeeze.

The two "Offer service" buttons are complementary — line 119 is `hidden sm:inline-flex` for desktop, line
153 is `sm:hidden` for mobile. The desktop one sits in a roomy header; the mobile one was added to a row
that cannot fit it.

**Fix.** Add `flex-wrap` to the row and `min-w-0` to the left block, or move the mobile button onto its own
row. The button still works today — it navigates correctly — so this is purely visual, but a marketplace
page that scrolls sideways on an iPhone reads as broken.

## 11. The bottom nav clips "Discover" at every mobile width

| viewport | needs | has | result |
|---|---|---|---|
| 360 px | 77 px | 64 px | **clipped** |
| 390 px | 77 px | 64 px | **clipped** |
| 414 px | 77 px | 69 px | **clipped** |

Every other label — Peeks, Post, Chats, Profile — fits exactly at all three widths. Only "Discover" fails,
at **every** width tested including the widest common iPhone, so it renders as "Disco…" in the primary
navigation on every screen of the app, signed in and signed out.

The label span (`BottomNav.jsx:71`) carries `max-w-full truncate` at `--findit-nav-label-size: 0.625rem`
(10 px, `src/index.css:60`) inside a 72 px item whose padding leaves 64–69 px usable.

**Fix.** Shortening the label is cheapest — "Browse" or "Home" both fit the existing box and read naturally
for the discovery surface. Otherwise drop the nav label size to `0.5625rem` or reduce item padding. Do not
widen the item: five items already fill the bar at 360 px.

## 12. Category tiles clip their labels

| viewport | Property | Cars | Machinery | Services |
|---|---|---|---|---|
| 360 px | **clipped** (75/63) | ok | **clipped** (89/63) | **clipped** (72/63) |
| 390 px | ok | ok | **clipped** (89/75) | ok |
| 414 px | ok | ok | **clipped** (89/85) | ok |

"Machinery" is clipped on every mobile width — rendering as "Machi…" — and at 360 px three of the four
tiles clip. These are the primary entry points into the marketplace.

`DiscoverCategoryCard.jsx:38` sets the content column to `w-[82%]` so the background image stays visible;
the `<h2>` at line 43 is `truncate text-base` (16 px, `font-black`). After a 36 px icon tile and a 10 px
gap, the heading gets 63–85 px against the 89 px "Machinery" needs.

**Fix.** Widening the content column to `w-[88%]` below `sm` is the only option that clears 360 px for all
four. Stepping the heading down (`text-sm sm:text-base`) recovers ~12 px — enough at 390 px, not at 360 px.

## 13. `/help/contact` renders zero headings

The page renders **no** `h1`–`h6` in its primary (form) state — `document.querySelectorAll('h1,h2,h3')`
returns `[]`.

"Contact Support" *looks* like a heading and is styled as one, but it is a `<CardTitle>`, and
`src/components/ui/card.jsx:30` renders that as a plain `<div>`. A screen-reader user landing on the
support page gets no heading to orient by, and heading navigation — a primary AT navigation mode — skips
the page entirely. `ContactSupport.jsx` does have an `<h1>` at line 64, but only in the post-submission
confirmation state, so the page gains a heading only after the user has already succeeded.

This is the only page in the app with the problem.

**Fix.** `<CardTitle asChild><h1>Contact Support</h1></CardTitle>`, or add an `<h1>` above the card. Worth
considering separately whether `CardTitle` should accept an `as` prop — it is used widely, and anywhere it
carries a section's real title it has the same gap.

## 14. Settings toggles are a 20 px tap target

The push-category switches on `/settings` measure **36×20 px**. Each is correctly labelled
(`aria-label="Messages push notifications"`), so this is hit area, not naming. 20 px is roughly 3 mm
against a 44 px (≈9 mm) minimum in both WCAG 2.5.5 and the Apple HIG.

Tested by network request rather than visual state, since the stub always echoed `true`:

```
tap row label (120 px left of switch):  0 update request(s)  -> row NOT tappable
tap 10 px below the switch:             0 update request(s)  -> MISSES
tap the switch itself:                  1 update request(s)  -> works
```

The switch is the only target, a near-miss does nothing, and the generous row of text beside it is inert.
`/settings` carries 21 sub-44 px controls in total, the most of any page.

**Fix.** Wrap each row in a `<label>` so the text and the whole row toggle the switch — hit area and
pointer affordance in one change, no visual redesign. Keep the `aria-label`s.

---

# Low

## 15. Touch targets under 44 px

- **Favourite ("Save item") button on listing cards — 36×36 px and 40×40 px** depending on surface. A
  primary interaction on the most-repeated component in the app, below both WCAG 2.5.5 and the Apple HIG
  minimum. It sits at the top-right of a card whose whole surface is a link, so a mis-tap opens the listing
  instead of saving it — two outcomes that are easy to confuse and easy not to notice.
- **Legal footer links — 14–16 px tall** ("Privacy", "Terms", "Cookies", "Data protection", "Community
  rules", "Help & safety"), stacked in two rows with small gaps, so both target size and spacing fall short.
- Category filter chips and the skip link are 40 px — marginal and consistent with the design system's
  `min-h-10`; a deliberate decision rather than a fix.

**Fix.** Give the favourite button a 44×44 px hit area (`h-11 w-11`) while keeping the icon size, and raise
the footer links' line-height or vertical padding to ~44 px of tappable height.

## 16. Nested `<main>` landmarks on 18 pages

`AppLayout.jsx:93` renders `<main id="main-content" tabIndex={-1}>` as the skip-link target. **18 page
components then render their own `<main>` inside it** — Home, Search, Services, all four detail pages,
CreateListing, Inquiries, LegalPage, Tours and others.

Two nested `main` landmarks is invalid per the HTML spec and ARIA practices (exactly one per document).
Practically, the skip link lands on an outer wrapper while the page's real content container is a different
element, and landmark navigation offers two "main" entries.

**Fix.** Change the inner elements to `<div>` or `<section>`; keep the `AppLayout` one, which owns the
skip-link target.

## 17. `/profile` menu descriptions truncate mid-word

```
"Record visual answers buyers wan…"   needs 252 px, has 244 px
"Terms, privacy, cookies and comm…"   needs 271 px, has 244 px
"Moderation, users and marketplac…"   needs 265 px, has 244 px
```

Computed style is `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` — the Tailwind
`truncate` utility. Right for a title that must stay on one line; wrong for explanatory subtitles whose job
is to say what the menu item does. All three lose their last words by 8–27 px.

**Fix.** `line-clamp-2` instead of `truncate` on the description line.

## 18. No sitemap, no structured data

No `sitemap.xml` anywhere in `public/`, and no JSON-LD or `schema.org` markup anywhere in `src/`, `public/`,
`functions/` or `index.html`.

`robots.txt` is thoughtful — it explains its reasoning and correctly notes *"this is not an access
control… every path below is enforced server-side by Supabase RLS"*, which is the right framing. Public
marketplace surfaces stay crawlable.

But `functions/_middleware.js` already fetches `title`, `description`, `price`, `currency` and
`public_location_label` per listing to build Open Graph tags. It has everything needed to emit `Product` /
`Offer` structured data and emits none — the difference between a plain blue link and a rich result showing
price, availability and image.

**Fix.** Add a JSON-LD block to the middleware path that already builds the OG tags; the data is in hand. A
sitemap needs a small generator over published listings, which can run as a scheduled workflow alongside
the existing maintenance jobs.

## 19. `/settings` carries seven top-level sections

Measured density at 390 px, signed in:

| screen | characters | controls |
|---|---|---|
| **/settings** | **3,231** | **21** |
| /admin | 1,315 | 9 |
| /admin/listings | 706 | 18 |
| /profile | 814 | 1 |
| /post | 615 | 4 |

Discover renders six components; Search, listing detail and chats are restrained. **The app reads as clean
because it mostly is.** `/settings` is the outlier at 2.5× the next densest screen:

```
Push notifications · Email notifications · Permissions & privacy
Account profile · Account security · Seller profile · Recommendation privacy
```

Four of seven are notification-or-privacy surfaces and two are profile editors, so a user wanting to turn
off one kind of email must work out which of four privacy-ish sections owns it.

**Fix — grouping, not deletion.** Two sections carry all seven: **Notifications** (push, email,
recommendation personalisation) and **Account** (profile, seller profile, security, permissions). Nothing
needs removing; the page needs one level of hierarchy.

`/profile` carries 11 menu items, which with a 5-item bottom nav is a lot of routes to the same places —
but no destination is reachable from more than four components, which is normal. Not worth solving.

## 20. Inert scaffolding

The user-facing app is not cluttered; the codebase is.

- **16 of 18 disabled feature flags gate zero code.** Nothing in `src/` references `featureFlags.payments`,
  `.subscriptions`, `.escrow`, `.premiumListings`, all four `ai*` flags, `.scheduledReminders`,
  `.marketingEmails`, `.currencyConversion`, `.phoneVerification`, `.internationalListing`,
  `.serviceRadius`, `.listingExpiry` or `.listingFreshnessReminders`. Only `toursPreview` and
  `previewFixtures` gate anything. Each of the 16 still costs a declaration, an `.env.example` line, a
  workflow line and validate-env entries — roughly 70 lines of config for capabilities with no
  implementation.
- **Seven dormant tables have zero client references**: `escrow_transactions`, `legal_practitioners`,
  `legal_bookings`, `legal_specializations`, `practitioner_reviews`, `practitioner_payouts`,
  `disposable_email_domains`, plus two migrations named for them.
- **Six dead exported constants**: `ZIMBABWE_LOCATIONS`, `PROVINCES`, `LEGAL_PRACTICE_AREAS`,
  `PRACTITIONER_TYPES`, `COLORS`, `LISTING_NUMBER_PREFIXES`.
- **Dead admin code**: `setAdminUserRole` exists in the service layer and the database, is audited, has no
  UI — and would be a no-op anyway, since `is_admin()` requires the founder email hash.
  `getAdminCategories` / `addAdminCategory` / `updateAdminCategory` are the superseded v1 taxonomy path.

**In fairness**, `featureFlags.js` states the policy: *"Central switchboard for capabilities that are
disabled-not-deleted."* Keeping the payments schema dormant is a defensible bet. But a flag that gates
nothing is not a disabled capability — it is a name with nothing behind it, and it makes `.env.example` and
the deploy workflow read as though the product does escrow, subscriptions, premium listings and four kinds
of AI.

**Suggested cut**, by payoff and safety: (1) delete the 6 dead constants and 3 superseded admin functions —
zero risk; (2) drop the 16 no-op flags from `featureFlags.js`, `.env.example`, the workflow and
`validate-env.mjs`, re-adding one when the feature is actually being built; (3) leave the dormant tables —
they cost nothing at runtime and `0008_payments_dormant.sql` is a documented decision.

## 21. Missing operational actions

None is a defect; each starts to hurt around the first hundred users.

- **No bulk actions.** Every admin table acts one row at a time — a spam wave means one dialog per listing.
- **No export.** No CSV or download from any admin surface: users, listings, reports, audit log.
- **No admin-initiated account deletion.** Admins can suspend and ban; only the user can delete. Fine until
  a deletion request must be actioned on someone's behalf.
- **No self-service data export** for members, which the Data Protection page correctly says is still
  handled through support — and which the same page promises as a right ("a copy of information you
  provided in a portable form").

## 22. Status documents no longer describe the repository

| document | claim | measured today |
|---|---|---|
| `PRODUCTION_READINESS_REPORT.md` | "78 contracts", "30 migrations deployed" | 969 tests, **201 migrations** |
| `QA_STATUS.md` | "215/215" | 969 |
| `RELEASE_CANDIDATE_VERIFICATION.md` | "215/215" | 969 |
| `PROJECT_STATUS.md` | "235/235" | 969 |

Three different numbers across four files, and a migration count off by 171. There are **42 markdown files
in the repository root**, none dated as a snapshot, all reading as current status. The verdicts are honest —
`PRODUCTION_READINESS_REPORT.md` says "Do not launch yet" — it is the figures that have drifted.

**Fix.** Date them explicitly as archives, or move them under `docs/archive/`.

## 23. Sign-out is labelled two ways

Members get "Log out" (`Profile.jsx:67`); admins get "Sign out" (`AdminSidebarCollapsible.jsx:55`). Same
action, same session, two words.

---

# Verified sound

Each of these was exercised, not assumed.

**Routing and wiring**
- **All 34 distinct internal navigation targets resolve to a declared route.** Every `<Link to>`,
  `<Navigate to>`, `navigate()` call and nav-config `path` cross-checked against the 48 declared routes.
  No dead links.
- **Feature-flag gating is consistent.** Every flag-gated route has all its entry points gated on the same
  flag — `TopNav` and `BottomNav` filter by `item.feature`/`previewFeature`, and all three
  `NotificationBell` render sites check `featureFlags.essentialNotifications`. There is no path to a route
  that has been flagged off.
- **Guest gating works.** `/saved` redirects to `/login?returnTo=%2Fsaved` — preserved and URL-encoded.
  Tapping gated nav items opens a "Sign in to continue" dialog rather than navigating or failing silently.
- **404 handling** renders a message, echoes the bad address, and offers a link home.

**Authentication**
- The full gate chain passes end to end: session read → `users` profile load → MFA assurance →
  `ProtectedRoute` role verification. No step short-circuits or hangs.
- `ProtectedRoute` re-verifies the admin role against the `is_admin` RPC rather than trusting React state.

**Admin console — all ten sections**
- Every sidebar link navigates. No dead entries.
- The dashboard renders live counts and each overview card links to its section.
- **Moderation is gated behind a confirmation dialog that requires a reason** — "Pause" opens a dialog with
  a text field rather than firing immediately, which is what makes the audit log meaningful.
- Filters and search work; **pagination is correct** — with one page of results both "Previous" and "Next"
  are `disabled`.
- Every admin page has exactly one `<h1>`.

**Member surfaces**
- All eleven render without error at both viewports.
- `/notifications` renders the alert list and offers "mark all read"; `/chats` renders the inbox with
  counterparty and last message; `/saved` groups favourites by category with counts.
- Push settings **correctly degrade** to "Push delivery is not configured for this deployment yet" when
  `VITE_WEB_PUSH_PUBLIC_KEY` is unset — the intended fallback, and a live demonstration of the repository
  audit's finding that an unset variable ships a silently push-less build with no build-time warning.
- Member action coverage is otherwise complete: edit and remove listings and services, pause/resume, block
  a conversation, report a listing, conversation and Peek, retry and remove your own Peek, email and push
  preferences, change password, MFA enrolment, personalisation opt-out, and account deletion.

**Accessibility mechanics**
- **Zero heading-level skips** across every route checked.
- **Every `<nav>` has an accessible name.** Live regions on every route. `lang="en"` set.
- **Zero duplicate element IDs, zero images without `alt`, zero hidden focusable elements.**
- **Zero focusable elements without a visible focus ring across 189 tab stops.** Unusual, and worth
  protecting.
- The skip link is the first tab stop on every page that has one and targets a real focusable element.
- The duplicate `<h1>` on Discover is **not** a defect: one is `sr-only md:hidden` for mobile, the other the
  desktop headline hidden below `md`.

**Forms and input boundaries**

| form | controls | labelled | autocomplete | required |
|---|---|---|---|---|
| `/login` | 2 | **2/2** | 2/2 | 2 |
| `/register` | 6 | **6/6** | 6/6 | 6 |
| `/help/contact` | 4 | 4/4 | 1/4 | 2 |

Empty submission surfaces an error on all three; `/help/contact` announces "Support category is invalid" in
a live region; `register` sets `inputmode` on the phone field. On the anon-writable support form: a
9,000-character message is **clamped client-side to exactly 4,000**, matching the database limit; unicode
and emoji survive intact; and a `<script>` + `<img onerror>` payload is **stored as text and never
executed**.

**PWA and service worker**
- Registered, controlling and **correctly stamped** (`peekalisting-shell-f0fc747e5b91`).
- Shell cache holds a valid `/` (3,268 bytes) and `/offline.html`; asset cache holds 60 entries. The
  `GET_VERSION` channel responds. `/offline.html` renders proper copy.

**Compatibility, dependencies and history**
- Feature detection is broadly correct: `setAppBadge`, `navigationPreload` and `navigator.share` all
  guarded; the clipboard fallback sits in a `try/catch` that surfaces a toast. Only `crypto.randomUUID` is
  inconsistent — guarded in one call site, assumed in three; it needs a secure context and Safari 15.4+, so
  it is safe in production but worth levelling.
- 23 direct production dependencies: **21 MIT, 1 Apache-2.0, 1 ISC**. No copyleft in the tree.
- **No secrets in git history** across all 71 commits — the only matches are the project's own
  `SECURITY_REVIEW.md` describing the scan and `verify-repository-hygiene.mjs` holding the patterns.

**Stability**
- **Zero JavaScript errors, zero unhandled page errors and zero 4xx responses** across all 88 route×viewport
  loads and every interaction run, signed out and signed in, member and admin.

---

# Limits

**Cross-browser testing could not be run.** Firefox and WebKit downloads are blocked by this environment's
network allowlist (`403 … no rule or allowlist entry allows host "cdn.playwright.dev"`). Only Chromium was
exercised, so no Safari- or Firefox-specific rendering and no real iOS standalone PWA behaviour. The
compatibility notes above are static analysis and are not a substitute.

**End-to-end offline navigation could not be verified.** Both Playwright's request interception and CDP's
`Network.emulateNetworkConditions offline:true` pre-empt the service worker in this harness, so every
offline navigation returned `ERR_INTERNET_DISCONNECTED` before the worker could answer. The cache is
confirmed to hold everything the fallback chain needs. **Please confirm manually**: DevTools → Network →
Offline, then reload.

**The backend was a stub**, so no server-side authorization was actually enforced — `is_admin` returned
`true` because the stub said so. The admin findings describe *client* behaviour; whether the database would
permit those actions is answered in the repository audit, which found the RLS, grant and trigger boundaries
sound.

**Data-dependent flows were not exercised**: listing creation, media upload, message sending, Peek playback,
map tiles, and whether moderation actions take effect — all confirmed to open their dialogs, none to
complete. Admin tables were driven with one to three rows; a 50-row queue may reveal pagination or
performance behaviour this could not.

**Also not covered:** colour contrast was measured on rendered text only, not icons, borders or focus
indicators (WCAG 1.4.11). Screen-reader behaviour was inferred from the accessibility tree, not a real
screen reader. Performance came from one synthetic profile with no field data. Whether the *missing* actions
matter is a product judgement, flagged with reasoning rather than asserted.

**Three measurement false starts**, recorded so the figures can be weighed:

1. The contrast checker first reported **124** failures — its background walk stopped short of `<html>`, so
   dark-theme text was compared against an assumed white page. Fixed, it reported **0**, because the
   "skip anything over a background-image" filter excluded everything. Instrumented properly it evaluates
   472 text nodes, skips 63 as over-image, and reports **18**. Only the third number is real.
2. The first performance run reported LCP 0 ms and 6 KB transferred — built with `vite build` directly
   rather than `npm run build`, so the service worker was never stamped and was serving from cache. The
   figures above are from a full pipeline build with the worker blocked.
3. A 474 px overflow on `/admin/listings` appeared once in a batch run and did not reproduce across 84
   samples — a measurement artefact, not reported as a finding. Likewise a "contact form has an unlabelled
   control" result, which turned out to be Radix's `aria-hidden` native `<select>`.
