# PHASE 11 — SEO, SHARING & DISCOVERABILITY

**Audited ref:** `origin/main` @ `ee6f212`

## 11.1 HEADLINE — there is no per-route metadata of any kind

Verified by search across all of `src/`:

- **No** `document.title` assignment
- **No** `react-helmet` / metadata library (absent from `package.json`)
- **No** per-route `<meta>` management
- **Zero** `og:` or `twitter:` tags in `index.html`
- **No** SSR or prerendering (`vite.config.js` is a plain client build; nothing in `package.json` prerenders)

Every route therefore serves the same static head from `index.html`: title *"PeekaListing Marketplace"* and
one generic description. A crawler or link unfurler fetching `/property/<id>` receives an empty
`<div id="root">` shell with no listing title, price, location or image.

### Consequences

| Surface | Result |
|---|---|
| **WhatsApp link preview** | Every shared listing renders an identical generic card with no title, price or photo. The brief identifies WhatsApp as a major contact channel in this market — this is the single highest-impact SEO/sharing defect. |
| Facebook / X / Signal previews | Same |
| Google indexing | Google can render JS, but with no per-page `<title>`, description or canonical, every listing competes as a duplicate of the shell |
| Structured data | None emitted — no `Product`, `Offer`, `RealEstateListing` or `Vehicle` schema |

→ **F-043 (P1)**

`src/lib/share.js` exists (32 KB chunk in the build) and handles the share action, but sharing a URL whose
target has no metadata still produces a blank preview.

## 11.2 robots.txt — well written

`public/robots.txt` is thoughtful and correct: it disallows `/admin`, `/chats`, `/messages`, `/my-listings`,
`/my-services`, `/notifications`, `/profile`, `/saved`, `/create`, `/create-service`, `/post` and all auth
routes, while leaving `/`, `/search`, `/services`, `/property/*`, `/car/*`, `/machinery/*`, `/service/*`,
`/seller/*`, `/dealer/*`, `/business/*`, `/help`, `/legal` crawlable. It explicitly states *"this is not an
access control"* — the correct mental model, and true here since RLS enforces the real boundary.

**Gaps:** the file is headed `# FindIt Marketplace` (**F-001**), and **no `sitemap.xml` exists or is
referenced** → **F-044 (P2)**. With no sitemap and no per-page metadata, discovery of individual listings
depends entirely on crawler JS rendering plus internal linking.

## 11.3 URLs and canonicalisation

| Aspect | State |
|---|---|
| Human-readable | Partial — `/property/<uuid>` is stable but carries no slug, so URLs are unreadable and unshareable in text |
| Canonical tags | **None** |
| Legacy redirects | Good — `/tours`→`/peek`, `/create`→`/post`, `/messages*`→`/chats*`, `/faqs`,`/support`→`/help` (`App.jsx:172-181`) |
| Facet canonicalisation | Not applicable yet — no per-route metadata to canonicalise |
| Deep linking | PASS — `vercel.json:5-10` rewrites all paths to `index.html` |
| Expired/unavailable listings | RLS removes them from public reads, so crawled URLs 404 into `PageNotFound` — acceptable, though without `410`/`404` status codes (SPA always returns 200) |

→ **F-045 (P3)** — UUID URLs with no slug; and the SPA returns HTTP 200 for removed listings.

## 11.4 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-043 | P1 | CONFIRMED | No per-route metadata, OG tags or prerendering — every shared listing produces an identical blank WhatsApp/social preview |
| F-044 | P2 | CONFIRMED | No sitemap.xml exists or is referenced |
| F-045 | P3 | CONFIRMED | Listing URLs are bare UUIDs with no slug, and removed listings return HTTP 200 |
