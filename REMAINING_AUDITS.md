# PeekaListing — accessibility, performance, PWA, SEO and hygiene

**Audit base:** `main` @ `28540ca`
**Covers what the previous five audits did not:** colour contrast, keyboard and screen-reader semantics,
runtime performance, offline/PWA behaviour, form and input boundaries, cross-browser compatibility, SEO
and structured data, dependency licences, git-history secrets, and whether the repository's own status
documents still describe reality.

Everything was measured against a real build driven in a browser, except where stated.

---

## Verdict

**Accessibility mechanics are genuinely good** — no heading-level skips, every `nav` labelled, live regions
on every route, zero duplicate IDs, zero images without `alt`, zero hidden focusable elements, and **every
focusable element has a visible focus ring**. That last one is rare.

Three findings matter. **Your primary brand colour fails WCAG AA against its own button label** — every
primary CTA in the app. **LCP is 6.3–7.5 seconds** on a mid-range phone, which is the runtime consequence
of the bundle finding from the repository audit. And **the retired "FindIt" name is still visible in 54
places**, including labels that assistive technology reads aloud.

One correction to an earlier audit is included below.

| # | Finding | Severity |
|---|---|---|
| 1 | Primary colour fails AA for white label text — every primary CTA | **High** |
| 2 | LCP 6.3–7.5 s on a throttled mobile profile | **High** |
| 3 | Retired "FindIt" brand in 54 user-visible strings, 3 of them screen-reader labels | **Medium** |
| 4 | Nine `[TO BE COMPLETED]` placeholders render live in Privacy and Terms | **Medium** |
| 5 | Nested `<main>` landmarks on 18 pages | **Low** |
| 6 | No sitemap and no structured data anywhere | **Low** |
| 7 | Four status docs give three different contract counts | **Low** |
| — | **Correction** to the actions audit: the legal deletion copy is *not* stale | — |

---

## 1. The primary colour fails contrast for its own label — High

Measured directly on the live button:

```
"Log in"  color rgb(255,255,255)  background rgb(61,145,255)
          16px / weight 600   ->  contrast ratio 3.14:1   (WCAG AA needs 4.5:1)
```

16 px at weight 600 is not "large text" (that needs 18.66 px at 700, or 24 px), so 4.5:1 applies. The
token is `--primary: 214 100% 62%` in the dark theme (`src/index.css:85`).

This is not one button. The same white-on-primary combination fails on:

- **Primary CTAs** — "Log in", "Create account", "Contact seller"
- **Unread count badges** in the nav (9 px / 700) — on 7 routes
- **Status pills** in the admin tables ("available") — 12 px / 600

The light theme is marginal too: `217 91% 54%` gives **4.44:1**, just under the 4.5 threshold.

**Fix.** Darken the primary token. Holding hue and saturation, lightness must drop to **48%** for white
text to clear AA:

| lightness | colour | ratio |
|---|---|---|
| 62% (current) | rgb(61,145,255) | 3.14 |
| 54% | rgb(20,122,255) | 3.99 |
| 50% | rgb(0,110,255) | 4.49 |
| **48%** | **rgb(0,106,245)** | **4.79** ✓ |

The alternative — keeping the blue and darkening the label text — usually looks worse on a saturated
button. Adjusting the token fixes every instance at once.

Across 15 routes and 472 evaluated text nodes there were **18 contrast failures in 5 distinct styles**;
the white-on-primary family accounts for 17 of them. The other is a timestamp at
`rgba(156,168,186,0.7)` scoring 4.39 — 0.11 short.

## 2. LCP is 6.3–7.5 seconds on a mid-range phone — High

Measured at 390 px with 4× CPU throttling and ~1.6 Mbps / 150 ms latency, cold cache, service worker
blocked:

| route | FCP | LCP | CLS | requests | transferred |
|---|---|---|---|---|---|
| `/` | 6,948 ms | **7,472 ms** POOR | 0.001 GOOD | 70 | 1,090 KB |
| `/search` | 6,932 ms | **7,356 ms** POOR | 0 GOOD | 66 | 1,064 KB |
| `/services` | 6,328 ms | **6,328 ms** POOR | 0.003 GOOD | 52 | 975 KB |

Google's LCP thresholds are ≤2.5 s good, >4 s poor. Every route is poor by roughly 3×. Main-thread
blocking is 277–419 ms across 3–5 long tasks.

**CLS is excellent** — 0.001 to 0.003, essentially no layout shift. Whatever is slow, it is not janky.

This is the runtime consequence of finding 1 in the repository audit: the initial payload is three
serially-resolved chunks totalling 724 KB raw / 213 KB gzip, of which the build budget gate measures only
the first. A three-hop request waterfall on a throttled connection is exactly a seven-second LCP.

**On the profile chosen:** 4× CPU throttle and 1.6 Mbps approximates a low-to-mid Android on a poor
connection. For a Zimbabwe marketplace that is arguably the *representative* device, not the worst case.
On a fast desktop connection these numbers will look fine, which is why the gate never caught it.

**Fix.** The same one as before — measure the transitive static import graph in
`verify-build-budget.mjs`, then either bring the payload under the existing 560 KB / 170 KB budget or
re-baseline deliberately. Adding `modulepreload` hints for the two undeclared chunks would collapse the
waterfall without changing a byte of application code, and is the cheapest single improvement available.

## 3. The retired brand name is still visible in 54 places — Medium

`grep` finds **54 user-visible occurrences of "FindIt"** in `src/`, across 19 files. Three are accessible
names that a screen reader announces — confirmed by reading the accessibility tree, not the source:

```
accessible controls on /help/contact:
  { role: "button",   name: "Refresh FindIt" }        <-- announced to AT
  { role: "combobox", name: "What do you need help with?" }
```

The others include:

| where | string |
|---|---|
| `AdminSidebarCollapsible.jsx:24` | `aria-label="FindIt admin overview"` |
| `DiscoverSearch.jsx:33` | `aria-label="Search FindIt"` |
| `GlobalRefreshButton.jsx:20,29,30` | toast + `aria-label` + `title` |
| `ProfileHeader.jsx:25` | fallback display name `'FindIt user'` |
| `DeleteAccountSection.jsx:78` | "Delete your **FindIt** account?" |
| `ReportListingDialog.jsx:44` | "…helping keep **FindIt** safe." |
| `LocationPermissionDialog.jsx:24,28` | two paragraphs of privacy copy |
| `create-listing/*` | 4 files in the listing wizard |
| `public/robots.txt:1` | `# FindIt Marketplace` |

**Why it survived.** `tests/peekaListingBrandContracts.test.mjs` asserts `doesNotMatch(/\bFindIt\b/)` —
but only against a **hardcoded list of ~25 file paths**. All 19 files above are outside that list. The
test passes, and has passed on every commit, while the retired name ships to users and to assistive
technology.

This is the substring-contract weakness from the repository audit in its purest form: a test that looks
like brand protection and actually protects a fixed list of files.

**Fix.** Replace the path list with a glob over `src/**/*.{js,jsx}` plus `public/robots.txt`, excluding
the `findit-` CSS class prefix and code comments. That turns a 25-file allowlist into a real invariant,
and it will fail immediately — which is the point.

Note `src/lib/legalContentOverrides.js` already does a runtime `replaceAll('FindIt', 'PeekaListing')` for
legal paragraphs. That works, but it patches rendered output rather than fixing the source, and it covers
only `legalContent.js`.

## 4. Nine `[TO BE COMPLETED]` placeholders render live — Medium

Read from the rendered pages, not the source:

| page | placeholders |
|---|---|
| `/legal/privacy` | **5** — operator legal name, registered address, privacy contact email, transfer mechanism, retention periods |
| `/legal/terms` | **4** — operator legal name, registered address, liability cap, mediation/arbitration step |
| `/legal/data-protection` | **1** — data-processing terms per provider |

So the published Privacy Policy currently tells a reader that the marketplace is operated by
`[TO BE COMPLETED: operator legal name]` and that data-rights requests go to
`[TO BE COMPLETED: privacy contact email]`.

**In fairness**, every legal page carries a visible banner: *"Review draft: this document provides a
practical launch baseline, not legal advice. Operator details, governing law, retention periods, and
country-specific requirements must be approved before public launch."* The placeholders are deliberate and
flagged. This is a launch blocker rather than a defect — but it is the kind that is easy to forget, and
the Privacy Policy is the first document a regulator reads.

## 5. Nested `<main>` landmarks — Low

`AppLayout.jsx:93` renders `<main id="main-content" tabIndex={-1}>` as the skip-link target. **18 page
components then render their own `<main>` inside it** — Home, Search, Services, all four detail pages,
CreateListing, Inquiries, LegalPage, Tours and others.

Two nested `main` landmarks is invalid per the HTML spec and the ARIA practices (exactly one per
document). Practically it means the skip link lands on an outer wrapper while the page's actual content
container is a different element, and screen-reader landmark navigation offers two "main" entries.

**Fix.** Change the inner elements to `<div>` or `<section>`. The outer `<main>` in `AppLayout` is the
correct one to keep, since it owns the skip-link target.

## 6. No sitemap, no structured data — Low

- **No `sitemap.xml`** anywhere in `public/`.
- **No JSON-LD or `schema.org` markup** anywhere in `src/`, `public/`, `functions/` or `index.html`.

`robots.txt` is thoughtful — it explains its own reasoning and correctly notes *"this is not an access
control… every path below is enforced server-side by Supabase RLS"*, which is exactly the right framing.
Public marketplace surfaces are left crawlable.

But the Pages middleware (`functions/_middleware.js`) already fetches `title`, `description`, `price`,
`currency` and `public_location_label` per listing to build Open Graph tags. It has everything needed to
emit `Product` / `Offer` structured data and emits none. For a marketplace that is the difference between
a plain blue link and a rich result showing price, availability and an image.

**Fix.** Add a JSON-LD block to the same middleware path that already builds the OG tags — the data is
in hand. A sitemap needs a small generator over published listings; it can be a scheduled workflow, since
one already exists for other maintenance jobs.

## 7. Status documents no longer describe the repository — Low

Four documents in the repository root state a contract count. They disagree with each other and with
reality:

| document | claim | measured today |
|---|---|---|
| `PRODUCTION_READINESS_REPORT.md` | "78 contracts", "30 migrations deployed" | 969 tests, **201 migrations** |
| `QA_STATUS.md` | "215/215" | 969 |
| `RELEASE_CANDIDATE_VERIFICATION.md` | "215/215" | 969 |
| `PROJECT_STATUS.md` | "235/235" | 969 |

Three different numbers across four files, and a migration count off by 171. There are **42 markdown files
in the repository root**, none dated as a point-in-time snapshot, all reading as current status.

The verdicts are honest — `PRODUCTION_READINESS_REPORT.md` says "Do not launch yet" — it is the figures
that have drifted. Worth either dating them explicitly as archives or moving them under `docs/archive/`.

---

## Correction to the actions audit

In the previous audit I reported that the Data Protection page contradicts the product by stating there is
no self-service account-deletion button while Settings renders one. **That was wrong.**

`src/lib/legalContentOverrides.js` intercepts that paragraph at render time and replaces it. The live page
reads:

> "Self-service account deletion is available in Settings. … Self-service data export is not yet available
> and export requests are handled through support."

which is accurate on both counts. I had read `legalContent.js` and not the rendered output. The rest of
that finding stands — data export genuinely does not exist — but the contradiction I described does not
reach users.

---

## Verified sound

**Keyboard and screen-reader semantics** — across 7 routes:

- **Zero heading-level skips.** No `h2 → h4` jumps anywhere.
- **Every `<nav>` has an accessible name.** Zero unlabelled.
- **Live regions on every route** (1–4 per page).
- **Zero duplicate element IDs**, **zero images without `alt`**, `lang="en"` set.
- **Zero hidden focusable elements** — no tabbing into invisible content.
- **Zero focusable elements without a visible focus ring** across 189 tab stops. This is unusual and worth
  protecting.
- The skip link is the first tab stop on every page that has one, and targets a real focusable element.

**Forms** — login, register and contact:

| form | controls | labelled | autocomplete | required |
|---|---|---|---|---|
| `/login` | 2 | **2/2** | 2/2 | 2 |
| `/register` | 6 | **6/6** | 6/6 | 6 |
| `/help/contact` | 4 | 4/4 | 1/4 | 2 |

Empty submission surfaces an error on all three; `/help/contact` announces "Support category is invalid"
in a live region. `register` sets `inputmode` on the phone field.

*(The contact form initially appeared to have an unlabelled control. It is Radix's hidden native
`<select>`, which is `aria-hidden` and absent from the accessibility tree — the tree correctly exposes
`combobox "What do you need help with?"`. Not a defect.)*

**Input boundaries** — probed on the anon-writable support form:

- A 9,000-character message is **clamped client-side to exactly 4,000**, matching the database limit.
- Unicode and emoji are preserved intact.
- A `<script>` + `<img onerror>` payload is **stored as text and never executed** — `window.__pwned`
  stayed undefined.
- No JavaScript errors under any input.

**PWA and service worker:**

- Registered, controlling, and **correctly stamped** (`peekalisting-shell-f0fc747e5b91`) — the version
  placeholder is substituted by the real build pipeline.
- Shell cache holds 4 entries including a valid `/` (3,268 bytes of HTML) and `/offline.html`; asset cache
  holds 60.
- The `GET_VERSION` message channel responds correctly.
- `/offline.html` renders proper copy: *"You're offline. PeekaListing can't reach the network right now…"*

**Cross-browser compatibility** (static, see limits): feature detection is broadly correct. `setAppBadge`,
`navigationPreload` and `navigator.share` are all guarded; the clipboard fallback sits inside a
`try/catch` that surfaces a user-facing toast. Only `crypto.randomUUID` is inconsistent — guarded in
`recommendationEventsService.js` and assumed in three other call sites. It requires a secure context and
Safari 15.4+, so it is safe in production, but the inconsistency is worth levelling.

**Dependencies and history:**

- 23 direct production dependencies: **21 MIT, 1 Apache-2.0, 1 ISC**. No copyleft anywhere in the tree.
- `npm audit`: 0 vulnerabilities (from the repository audit).
- **No secrets in git history** across all 71 commits — the only matches are the project's own
  `SECURITY_REVIEW.md` describing the scan and `verify-repository-hygiene.mjs` containing the detection
  patterns. That script already automates this check.

---

## Method and limits

**Cross-browser testing could not be run.** Firefox and WebKit downloads are blocked by this environment's
network allowlist (`403 request blocked: no rule or allowlist entry allows host "cdn.playwright.dev"`).
Only Chromium is available, so no Safari- or Firefox-specific rendering, and no real iOS standalone PWA
behaviour, was exercised. The compatibility findings above are static analysis and should not be treated
as a substitute.

**End-to-end offline navigation could not be verified.** Both Playwright's request interception and CDP's
`Network.emulateNetworkConditions offline:true` pre-empt the service worker in this harness, so every
offline navigation returned `ERR_INTERNET_DISCONNECTED` before the worker could answer. What I could
verify is that the cache contains everything the fallback chain needs. **Please confirm manually**:
DevTools → Network → Offline, then reload — you should get the app shell, and an unknown route should give
`/offline.html`.

**Three false starts worth recording**, since they affect how much weight to put on the numbers:

1. The contrast checker first reported **124** failures. Its background walk stopped short of `<html>`, so
   dark-theme text was being compared against an assumed white page. Fixed, it reported **0** — because the
   "skip anything over a background-image" filter was excluding everything. Instrumented properly, it
   evaluates 472 text nodes, skips 63 as over-image, and reports **18**. Only the third number is real.
2. The first performance run reported LCP 0 ms and 6 KB transferred — I had built with `vite build`
   directly rather than `npm run build`, so the service worker was never stamped and was serving from
   cache. Rebuilt through the real pipeline with the worker blocked, the numbers above are cold-cache.
3. The contact-form "unlabelled control" was Radix's `aria-hidden` native select, as noted above.

**Not covered.** Colour contrast was measured on rendered text only, not on icons, borders or focus
indicators (WCAG 1.4.11 non-text contrast). Screen-reader behaviour was inferred from the accessibility
tree, not from a real screen reader. Performance was measured on one synthetic profile; no field data.
Structured-data and sitemap findings are about absence, so there was nothing to validate.
