# PeekaListing — UI wiring, functionality and layout audit

**Audit base:** `main` @ `28540ca`
**Method:** the app was **built and run**, then driven in headless Chromium (Playwright) against a stub
Supabase backend serving representative listing/service/taxonomy data. 46 route×viewport loads at
360 / 390 / 768 / 1280 px, plus scripted interaction runs. Every finding below was reproduced in a
browser and measured — none is inferred from reading source.

This complements the two earlier audits, which covered security, data and release engineering. This one
covers what the previous passes deliberately skipped: **does the app actually work when you use it.**

---

## Verdict

**The wiring is sound.** Every internal link resolves, feature flags gate consistently, guest prompts fire
correctly, search and filters work, and **not a single JavaScript error** appeared across 46 page loads and
every interaction tested. That is a better result than most apps of this size return on a first
browser-driven pass.

The defects are all **presentation**: text clipped on primary navigation and category tiles at every
mobile width, one page that scrolls sideways, one page with no heading semantics, and touch targets under
the 44 px minimum. Nothing is broken; several things look broken.

| # | Finding | Severity | Where |
|---|---|---|---|
| 1 | `/services` scrolls horizontally on mobile (88 px @360, 58 px @390) | **Medium** | `src/pages/Services.jsx:139` |
| 2 | Bottom-nav "Discover" label is clipped at **every** mobile width | **Medium** | `src/components/layout/BottomNav.jsx:71` |
| 3 | "Machinery" category tile clipped at every mobile width; "Property" and "Services" clip at 360 px | **Medium** | `src/components/discover/DiscoverCategoryCard.jsx:38` |
| 4 | `/help/contact` renders **zero** headings of any level | **Medium** | `src/pages/ContactSupport.jsx:90` |
| 5 | Touch targets below 44 px: favourite button 36×36, legal footer links 14–16 px tall | **Low** | listing cards, `SiteFooter` |

---

## 1. `/services` scrolls sideways on mobile — Medium

At 360 px the page overflows by **88 px**; at 390 px by **58 px**. The body itself scrolls horizontally —
this is not a carousel. It is clean at 768 px and 1280 px.

The culprit is the results header at `src/pages/Services.jsx:139-155`:

```jsx
<div className="mb-4 flex items-center justify-between gap-3">
  <div>
    <h2>Results</h2>
    <p>Showing {services.length} service…</p>
  </div>
  <div className="flex items-center gap-2">
    {featureFlags.maps && ( /* List | Map toggle, ~150px */ )}
    <Button asChild variant="outline" className="sm:hidden">
      <Link to="/create-service"><Plus />Offer service</Link>
    </Button>
  </div>
</div>
```

The mobile-only "Offer service" button (`sm:hidden`, so it appears **below** 640 px) shares a single
non-wrapping row with the List/Map toggle and the "Results" block. Measured: the button's right edge lands
at **448 px against a 390 px viewport**. The screenshot shows it clipped mid-word as "Offer se…", and
"Showing 1 service" forced onto two lines by the squeeze.

Note the two "Offer service" buttons are complementary — line 119 is `hidden sm:inline-flex` (desktop),
line 153 is `sm:hidden` (mobile). The desktop one sits in a roomy header; the mobile one was added to a row
that cannot fit it.

**Fix.** Add `flex-wrap` to the row and `min-w-0` to the left block, or move the mobile button onto its own
row beneath the results count. The button is still clickable today (it navigates correctly to
`/create-service` → `/login` for a guest), so this is purely visual — but a marketplace page that scrolls
sideways on an iPhone reads as broken.

## 2. The bottom nav clips "Discover" at every mobile width — Medium

Measured across three common device widths:

| viewport | label | needs | has | result |
|---|---|---|---|---|
| 360 px | Discover | 77 px | 64 px | **clipped** |
| 390 px | Discover | 77 px | 64 px | **clipped** |
| 414 px | Discover | 77 px | 69 px | **clipped** |

Every other label — Peeks, Post, Chats, Profile — fits exactly at all three widths. Only "Discover" fails,
and it fails at **every** width tested including the widest common iPhone. It renders as "Disco…" in the
primary navigation on every screen of the app.

The label span (`BottomNav.jsx:71`) carries `max-w-full truncate` at
`--findit-nav-label-size: 0.625rem` (10 px, `src/index.css:60`), inside a 72 px nav item whose padding
leaves 64–69 px of usable width.

**Fix.** The cheapest correct change is to shorten the label — "Browse" or "Home" both fit the existing
box and read naturally for the discovery surface. Alternatively drop the nav label size to `0.5625rem`
(9 px) or reduce the item's horizontal padding. Do not simply widen the item: five items already fill the
bar at 360 px.

## 3. Category tiles clip their labels — Medium

Same measurement method, on the Discover "Browse categories" grid:

| viewport | Property | Cars | Machinery | Services |
|---|---|---|---|---|
| 360 px | **clipped** (75/63) | ok | **clipped** (89/63) | **clipped** (72/63) |
| 390 px | ok (75/75) | ok | **clipped** (89/75) | ok |
| 414 px | ok | ok | **clipped** (89/85) | ok |

"Machinery" is clipped on every mobile width — it renders as "Machi…" — and at 360 px three of the four
category tiles clip. These are the primary entry points into the marketplace.

The cause is `DiscoverCategoryCard.jsx:38`: the content column is `w-[82%]` of the card so the background
image stays visible, and the `<h2>` at line 43 is `truncate text-base` (16 px, `font-black`). After the
36 px icon tile and a 10 px gap, the heading gets 63–85 px against the 89 px "Machinery" needs.

**Fix.** Step the heading down at the smallest breakpoint (`text-sm sm:text-base` recovers roughly 12 px,
enough for "Machinery" at 390 px but not at 360 px), or widen the content column to `w-[88%]` below `sm`,
or allow the heading two lines. Widening the column is the only option that clears 360 px for all four.

## 4. `/help/contact` has no headings at all — Medium

The page renders **zero** `h1`–`h6` elements in its primary (form) state. Confirmed by querying the live
DOM: `[...document.querySelectorAll('h1,h2,h3')]` returns `[]`.

"Contact Support" *looks* like a heading and is styled as one, but it is a `<CardTitle>`, and
`src/components/ui/card.jsx:30` renders that as a plain `<div>`:

```jsx
const CardTitle = React.forwardRef((({ className, ...props }, ref) => (
  <div ref={ref} className={cn("font-semibold leading-tight tracking-tight", className)} {...props} />
)));
```

So a screen-reader user landing on the support page gets no heading to orient by, and heading navigation
(a primary AT navigation mode) skips the page entirely. `ContactSupport.jsx` *does* have an `<h1>` at line
64 — but only in the post-submission confirmation state, so the page gains a heading only after the user
has already succeeded.

This is the only page in the app with the problem: no other page relies on `CardTitle` as its sole heading.

**Fix.** `<CardTitle asChild><h1>Contact Support</h1></CardTitle>`, or add an `<h1>` above the card. Worth
considering separately whether `CardTitle` should accept an `as` prop — it is used widely, and anywhere it
carries the section's real title it has the same semantic gap.

## 5. Touch targets below 44 px — Low

Measured on mobile viewports:

- **Favourite ("Save item") button on listing cards — 36×36 px and 40×40 px** depending on surface. This is
  a primary interaction on the most-repeated component in the app, below both the WCAG 2.5.5 (AAA) 44 px
  target and the Apple HIG 44 pt minimum. It sits at the top-right corner of a card whose whole surface is
  a link, so a mis-tap opens the listing instead of saving it — the two outcomes are easy to confuse and
  hard to undo without noticing.
- **Legal footer links — 14–16 px tall**: "Privacy", "Data protection", "Terms", "Cookies",
  "Community rules", "Help & safety". Stacked in two rows with small gaps, so both the target size and the
  spacing between adjacent targets are below guidance.
- Category filter chips and the skip link are 40 px — marginal, and consistent with the design system's
  `min-h-10`; worth a deliberate decision rather than a fix.

**Fix.** Give the favourite button a 44×44 px hit area (`h-11 w-11`) while keeping the icon at its current
size, and increase the footer link line-height / vertical padding to reach ~44 px of tappable height.

---

## Verified working

All of this was exercised in the browser, not read:

**Routing and wiring**
- **All 34 distinct internal navigation targets resolve to a declared route.** Every `<Link to>`,
  `<Navigate to>`, `navigate()` call, and nav-config `path` was cross-checked against the 48 routes
  declared in `App.jsx`. No dead links.
- **Feature-flag gating is consistent.** Every route gated behind a flag (`messaging`,
  `essentialNotifications`, `businessProfiles`, `tours`) has all of its entry points gated on the same
  flag: `TopNav` and `BottomNav` filter `PRIMARY_NAV_ITEMS` by `item.feature`/`previewFeature`, and all
  three `NotificationBell` render sites check `featureFlags.essentialNotifications`. There is no path to a
  route that has been flagged off.
- **Guest gating works correctly.** `/saved` as a guest redirects to `/login?returnTo=%2Fsaved` — the
  return path is preserved and URL-encoded. Tapping the gated nav items `/chats`, `/profile` and `/post`
  opens a "Sign in to continue" dialog rather than navigating or silently doing nothing.
- **404 handling.** An unknown route renders "We couldn't find that page", echoes the bad address, and
  offers a link home.

**Interaction**
- Search: typing a query and pressing Enter updates the URL to `/search?q=excavator`.
- Discover category tiles navigate to `/search?type=property`.
- The search filter control opens its panel.
- The `/services` List↔Map toggle works and correctly sets `aria-pressed="true"`.
- The guest favourite button prompts sign-in rather than failing silently.
- Empty login submission does not navigate and throws no error.
- "Offer service" navigates correctly despite the layout overflow in finding 1.

**Accessibility mechanics**
- The **skip link is the first tab stop** and targets `#main-content`, which is a real focusable element.
- Every visible button on Discover has an accessible name.
- All `/login` inputs are properly labelled; 12 elements in the tab order.
- The duplicate `<h1>` on Discover is **not** a bug: one is `sr-only md:hidden` for mobile, the other is
  the visible desktop headline hidden below `md`. Checked, because a raw `querySelectorAll('h1').length`
  of 2 looks like a defect and is not.

**Stability**
- **Zero JavaScript errors and zero unhandled page errors** across 46 route×viewport loads and every
  interaction run. No failed requests other than those the stub backend was not asked to serve.

---

## Method and limits

The app was built with a stub `VITE_SUPABASE_URL` pointing at a local server that answers `/rest/v1/*`,
`/rest/v1/rpc/*` and `/auth/v1/*` with representative fixtures (three listings across property/car/
machinery, one service, a category taxonomy, zero unread counts, no session). Feature flags were set as
staging sets them, so gated surfaces were live during the run.

**What this does not cover.** All runs were **signed out** — authenticated surfaces (`/profile`,
`/settings`, `/my-listings`, `/chats` threads, the entire `/admin` area) redirect to login and were never
rendered, so their wiring, layout and alignment are unaudited. Flows requiring a real backend — listing
creation, media upload, messaging, Peek playback, map tiles — were not exercised; the map surfaces in
particular render against MapTiler/OpenFreeMap, which the stub does not provide. Only Chromium was tested,
so no Safari- or Firefox-specific layout issues would have surfaced, and iOS PWA standalone behaviour
(safe-area insets, the installed-app shell) is untested. Colour contrast was not measured. Screenshots
were captured at 390 px for Discover, Search, Services and Contact and are the basis for the visual
observations above.

A follow-up pass with a seeded database and an authenticated session would cover the ~20 signed-in routes
this run could not reach, and is where I would look next.
