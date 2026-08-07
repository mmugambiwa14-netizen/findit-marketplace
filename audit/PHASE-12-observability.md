# PHASE 12 — OBSERVABILITY & OPERATIONS

**Audited ref:** `origin/main` @ `ee6f212` · Hosted dashboards/alerting ⛔ E-001/E-004

## 12.1 Frontend error capture — absent

**No Sentry or equivalent exists.** `sentry` appears in neither `package.json` nor any file in `src/`.
The only production error visibility is 4 `console.error` call sites, deliberately preserved
(`vite.config.js:54-57` documents keeping `console.error`/`warn` while marking `console.log/info/debug` pure,
and notes each logs an `Error` object rather than a token, session or request body — a good PII decision).

Consequently: a render error caught by `AppErrorBoundary`, a bootstrap failure, a chunk-load failure after
deploy, or a failed Peek upload on a seller's phone produces **no signal reaching the operator**. The team
would learn about breakage only from user reports.

Source maps are deliberately disabled and gate-enforced (Phase 1), so even if a reporter were added it would
need an authenticated source-map upload step rather than public maps.

→ **F-046 (P1)**

## 12.2 What does exist — and it is good

| Capability | Evidence |
|---|---|
| **Correlation IDs** | `src/lib/traceContext.js` — `x-request-id` header, `peekalisting.trace-session` storage key, `createTraceId()` using `crypto.randomUUID()` with a fallback |
| Operational metrics | `operational_metric_buckets`, `operational_alerts`, `app_alerts` tables |
| Health endpoints | `supabase/functions/contextual-ecosystem-health`, `recommendation-service-health`, `tour-observability-monitor` |
| Media failure tracking | `listing_tour_events`, `tour_asset_cleanup_queue`, `recommendation_projection_dead_letters` (dead-letter queue) |
| Circuit breaking | `recommendation_service_circuit_state` |
| Admin visibility | `AdminOperationalHealth.jsx`, `/admin/audit-log` → `audit_logs` |
| Runbooks | `docs/OBSERVABILITY.md`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/BACKUP_AND_DISASTER_RECOVERY.md`, `docs/CLOUDFLARE_STAGING_RUNBOOK.md`, `docs/RECOMMENDATION_DATABASE_GATE_RUNBOOK.md` |

The server-side and database-side observability design is thorough — dead letters, circuit state, metric
buckets and health probes are all present. The gap is specifically the **browser**, where the users are.

## 12.3 Product analytics — absent

No analytics library, no event pipeline. Searching `src/` for analytics returns only
`AdminRecommendationAnalytics.jsx` (an internal admin view over `recommendation_*` tables) and legal copy.

None of the four critical funnels named in the audit brief are measurable:

| Funnel | Measurable? |
|---|---|
| Buyer: search → detail → Public Peek → request/contact → message | **No** |
| Seller: create start → media → validate → publish | **No** |
| Peek fulfilment: received → accepted → capture → upload → processed → bound | Partially, from `listing_tour_events` server-side |
| Business: application → decision → activation | Partially, from table state |

Server-side tables allow post-hoc SQL reconstruction of *outcomes*, but not of **drop-off** — the thing a
pre-launch marketplace most needs to know. Without it there is no way to tell whether sellers abandon at
media upload or at contact entry.

→ **F-047 (P2)** — recorded as a measurable gap; the brief permits an explicitly accepted gap here, so this
is a decision to take consciously rather than by default.

## 12.4 PII in logs

Assessed **clean**. Only 7 `console.*` sites in `src/`; the build drops `log`/`info`/`debug` as pure and the
retained `console.error` calls log `Error` objects. No token, session or request-body logging found.

## 12.5 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-046 | P1 | CONFIRMED | No frontend error reporting exists, so browser failures are invisible to operators |
| F-047 | P2 | CONFIRMED | No product analytics; none of the four critical funnels is measurable for drop-off |
