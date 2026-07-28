# External Blockers

Checks that could **not** be run in this audit, and why. These are recorded as
blocked, not as passed or failed. Nothing in this list was assumed, simulated or
inferred from existing documentation.

This matters for one reason: several claims that can only be proven by these
checks — particularly about scale and runtime behaviour — are therefore
**unproven**, and PRODUCTION_READINESS.md is explicit that it makes no capacity
claim without them.

## 1. Docker Desktop + Supabase CLI

**Blocks:** the entire local Supabase stack.

| Command | Purpose |
|---|---|
| `supabase start` | Local Postgres/Auth/Storage/Edge runtime |
| `supabase db reset --local --no-seed` | Apply all 44 migrations to a clean database |
| `supabase db lint --local` | Schema linting |
| `supabase test db` | The 12 pgTAP suites in `supabase/tests/` |

**Unproven as a result:**
- That the 44 migrations actually apply cleanly end to end. Static analysis says
  they are contiguous, non-destructive and self-provisioning, but **execution is
  the only proof.**
- The 12 pgTAP suites, which are the *runtime* verification of RLS, the function
  privilege matrix, storage policies and the tour foundation. The 239 passing
  contract tests are static source assertions and are **not** a substitute.

**To unblock:** install Docker Desktop and Supabase CLI ≥ 2.109, then run the
sequence in `README.md`. This is the single highest-value unblock available.

## 2. Supabase credentials (`.env`)

**Blocks:** every check that needs a project URL and key.

| Command | Observed | Why |
|---|---|---|
| `npm run validate:env` | **exit 1** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` missing |
| `npm run verify:oauth-providers` | **exit 1** | needs `FINDIT_SUPABASE_URL`, `FINDIT_SUPABASE_ANON_KEY` |
| `npm run dev` | not run | client throws at load without config |

Both failures are **correct fail-closed behaviour**, not defects — the app
refuses to start unconfigured rather than silently defaulting to some backend.

**To unblock:** `cp .env.example .env` and populate from `supabase status`
(local) or the project dashboard (hosted). Never place a service-role key in a
`VITE_` variable.

## 3. Running Supabase instance — smoke suites

**Blocks:** ~30 `test:*-local` and `test:*-hosted` scripts. All exist on disk
(all 40 script paths in `package.json` resolve) but need a live stack:

- Auth: `test:auth-local`, `test:auth-hosted`
- Domain: owner-listings, services, admin, business-profiles, messaging,
  notifications, listing-creation, listing-expiry, media-lifecycle
- Tours: upload, processing, lifecycle, seller, integration, discovery,
  moderation, scale, observability
- Scale: `test:search-scale`, `test:messaging-scale`, `test:notification-scale`
- `npm run certify:release-candidate`

**Unproven as a result:** all runtime behaviour — auth flows, RLS under real
sessions, upload paths, worker scheduling, and **every scale characteristic**.

## 4. GitHub Actions

**Blocks:** all 5 workflows — `deploy-staging-pages`, `maintenance-workers`,
`migration-gates`, `release-candidate-gates`, `tours-staging-acceptance`.

`README.md` records that the account returns `startup_failure` before creating
jobs, and that the gates were instead executed from a clean local checkout. That
account-level block is a pre-existing launch item, carried forward here.

**Note:** this audit found two gates that fail *locally on Windows* for reasons
CI would not have surfaced (F-03, F-02). Local execution is therefore not fully
equivalent to CI, and the CI block should not be treated as cosmetic.

## 5. Deployment targets

Not provisioned, and explicitly out of scope for this audit:

- Frontend host / domain (currently a GitHub Pages URL hardcoded in
  `config.toml` — D-04)
- Production SMTP (`config.toml` has the block commented out; the 13 email
  templates exist and are wired but cannot deliver)
- CDN for tour media (`TOUR_CACHE_PURGE_URL` unset — P-05)
- External tour transcoding provider (`TOUR_PROCESSOR_URL`,
  `TOUR_PROCESSOR_SECRET` unset)
- Monitoring/alerting sink for `operational_alerts`
- Backup schedule and a **rehearsed** restore (P-06)

## 6. Browser and device acceptance

No browser was launched. Not assessed: real rendering, responsive behaviour at
breakpoints, keyboard navigation in practice, screen-reader output, touch
targets, or mobile network performance.

The static accessibility signals are good — `audit:product-surface` reports 0
findings, the search combobox implements `aria-activedescendant` with full arrow/
enter/escape handling, and a keyboard skip link is asserted by the contract
suite. But static assertions and real assistive-technology behaviour are
different things, and only the former was verified.

## Summary

| Blocker | Unblocked by | Priority |
|---|---|---|
| Docker + Supabase CLI | Local install | **Highest** — proves the migrations |
| `.env` credentials | Copy template, fill from `supabase status` | High |
| Live stack for smoke suites | Follows from the above two | High |
| GitHub Actions | Account-level resolution | Medium |
| Deployment targets | Provisioning decisions | Medium |
| Browser/device acceptance | Manual QA pass | Medium |

Until items 1–3 are cleared, the honest position is: **the schema and code have
been read and analysed thoroughly, and they have not been executed.**
