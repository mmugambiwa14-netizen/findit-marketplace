# PHASE 10 — PERFORMANCE & LOW-BANDWIDTH RESILIENCE

**Audited ref:** `origin/main` @ `ee6f212` · Real build measured locally ✅ · No field/Lighthouse measurement (no running app) — Core Web Vitals are UNVERIFIED.

## 10.1 Measured bundle (real `vite build`)

| Metric | Value |
|---|---|
| `dist/` total | 3.3 MB |
| JS | 1,507,014 bytes across **151** chunks |
| CSS | 111,208 bytes across 3 |
| Source maps | 0 |
| Initial payload (`index` + `App` + `BrandLogo` shared chunk) | ≈ **594 KB raw / 178 KB gzip** |

`verify-build-budget.mjs` **passes**, so this is within the project's declared budget. Route splitting is
real: every page is `lazy()`-imported (`App.jsx:31-70`).

**Judged against the target (mid-range Android, throttled 3G):** ~178 KB gzip of JS before any content
renders is heavy. On a 400 kbps effective connection that is roughly 3.5–4 s of transfer alone, before
parse/execute on a low-end device. The project has already measured and rejected vendor chunking with
numbers (`vite.config.js:73-77`), so the remaining lever is what the shell imports, not re-chunking.
→ **F-040 (P2)**, framed as a budget-tightening opportunity rather than a defect, since the declared budget gate is green.

## 10.2 Data-per-card

The public listing projection is a 35-column allowlist including `description` (up to 5,000 chars),
`variants` and `photos` jsonb. Search result rows therefore carry full descriptions even though cards render
a title, price and thumbnail. → **F-041 (P2)** — on a 3G connection with constrained data plans, shipping
5 KB of description per card for a 20-card page is ~100 KB of waste per scroll. A narrower card projection
(dedicated RPC or column subset) is the fix.

## 10.3 Media

- Peek playback: 720p transcode, private buckets, signed URLs; `tour-thumbnails` capped at 5 MB `image/webp` — derivative-based, correct.
- `Tours.jsx:245` documents keeping only current/previous/next Peek resident and pausing on background — genuinely considerate memory and data handling.
- Listing images: `listing-images` bucket with `listing_upload_intents` recording `byte_size` and `mime_type`. **No evidence of server-side derivative generation or `srcset`/`sizes` for listing stills** was found. → **F-042 (P2)** — grids likely serve full-size uploads.

## 10.4 Caching and request behaviour

`src/lib/query-client.js:6-11`:

```js
staleTime: 1000 * 60 * 30,   // 30 minutes
gcTime:    1000 * 60 * 60,   // 1 hour
refetchOnWindowFocus: false,
refetchOnReconnect:   false,
retry: 1,
```

This is a **deliberate and defensible low-bandwidth optimisation** — it minimises repeat requests on
expensive mobile data, and `retry: 1` avoids amplifying failures on flaky connections. Recorded as a
strength for the stated market.

Its cost is correctness: a buyer can act on a listing sold or withdrawn up to 30 minutes earlier, and
neither regaining focus nor regaining connectivity triggers a refresh. This is the same root cause as the
messaging latency in **F-031**. The right resolution is per-query rather than global — keep long staleness
for taxonomy and reference data, shorten it for listing status and conversations.
→ folded into **F-031**; noted here as the performance/freshness trade-off.

## 10.5 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-040 | P2 | CONFIRMED | ~178 KB gzip initial JS is heavy for the mid-range-Android / 3G target, though within the declared budget |
| F-041 | P2 | CONFIRMED | Public listing projection ships full descriptions to card/search views |
| F-042 | P2 | LIKELY | No evidence of server-side image derivatives or `srcset` for listing stills |

**UNVERIFIED without a running app:** LCP, INP, CLS, actual transfer per route, scroll restoration, memory leaks.
