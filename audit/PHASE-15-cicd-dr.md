# PHASE 15 — CI/CD, ENVIRONMENTS, CLOUDFLARE & DR

**Audited ref:** `origin/main` @ `ee6f212` · **GitHub Actions verified live** ✅ · Vercel/Supabase/Cloudflare ⛔ E-001/E-003/E-004

## 15.1 GitHub Actions — measured, not assumed

Live query of the Actions API for branch `main`:

| Workflow | At `ee6f212` | Last 30 runs on `main` |
|---|---|---|
| Release candidate gates | **failure** | 0 success / 4 failure |
| Release Certification | **failure** | 0 success / 4 failure |
| Migration gates | **failure** | 0 success / 4 failure |
| Deploy staging to GitHub Pages | **failure** | 0 success / 3 failure / 1 cancelled |
| GitHub Pages Preview | **failure** | 0 success / 4 failure / 1 cancelled |
| Run marketplace maintenance workers | success | 2 success / 4 failure / 1 cancelled |

**Zero successful release, certification, migration or deployment runs.** Root cause and the resulting
skip cascade are documented in Phase 1 (**F-012**, **F-013**).

Because "Deploy staging to GitHub Pages" fails, **there is no working staging deployment** — which
undermines the `stagingCertifiedFlag` model entirely, since Peeks, messaging, notifications and
current-location only switch on in a trusted staging environment (`stagingCapabilityPolicy.js:37-39`).
The capability model depends on an environment that is not being built. → **F-054 (P1)**

**Triggers are correctly configured** — `release-candidate-gates.yml`, `migration-gates.yml` and
`release-certification.yml` all fire on `pull_request` and `push: main`, with no `continue-on-error` on the
gate steps. Three workflows are manual/schedule only by design: `maintenance-workers.yml`,
`provision-cloudflare-staging.yml`, `tours-staging-acceptance.yml`.

**Node pinning is correct** — job step 4 is "Use Node.js 24", satisfying `engines.node >= 23.6.0` (this is
why F-005 was downgraded to P3).

**Branch protection is EXTERNAL EVIDENCE REQUIRED** (E-007). The observable fact that `ee6f212` — a merge
commit titled *"final-release-certification"* — sits on `main` with five red workflows strongly suggests the
gates are **not** required checks, since a required failing check would have blocked the merge.

## 15.2 Environments

| Environment | Repository evidence | Verified? |
|---|---|---|
| Production (Vercel, `peekalisting.com`) | `vercel.json` only; **no workflow deploys to production** | ⛔ E-003 / E-006 |
| Staging (GitHub Pages) | `deploy-staging-pages.yml` — **currently failing** | Repo-visible, broken |
| Preview | `pages-preview.yml` — **currently failing** | Repo-visible, broken |
| Supabase staging / production | 159 migrations, `config.toml` | ⛔ E-004 |

**Preview-writes-production is a P0 per Appendix A and cannot be assessed from the repository.** The audit
does **not** mark it PASS. `stagingCapabilityPolicy.js` makes this materially riskier than usual: a preview
served from a `findit-marketplace-stagi*.vercel.app` hostname auto-enables gated capabilities (**F-004**),
so if preview also points at the production Supabase project, previews would exercise production data with
extra capabilities switched on. **E-003 must be resolved before launch.**

## 15.3 Cloudflare

Everything is repository-defined and **nothing is verified**. `workers/edge/src/index.ts:1-13` declares
3 R2 buckets, a Queue, a KV namespace and a Durable Object; `infrastructure/cloudflare/` contains only
`.example` files with **no committed `wrangler.toml`**. Four bindings — `PLATFORM_CONFIG`, `RATE_LIMITS`,
`LIGHTWEIGHT_JOBS`, `MEDIA_DELIVERY_HOST` — appear exactly once each, i.e. **declared but never used** in
the 187-line Worker body. → **F-055 (P2)**: the Cloudflare edge layer is largely aspirational; live media
delivery runs through Supabase Storage signed URLs (Phase 3 §3.9, and the CSP at `vercel.json:17` confirms
only `*.supabase.co` is permitted for `media-src`).

Turnstile: server function exists, never invoked (**F-034**). R2/Workers/Queues provisioning: **E-001**.

## 15.4 Disaster recovery

| Control | State |
|---|---|
| Migration rollback scripts | **100** rollback scripts for **159** migrations — **59 migrations have no rollback** → **F-056 (P2)** |
| Rollback gate | `verify:sql-boundary` enforces non-destructive rollbacks — and is what is currently red (F-013) |
| DR documentation | `docs/BACKUP_AND_DISASTER_RECOVERY.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/DEPLOYMENT_RUNBOOK.md` |
| PITR / backups | ⛔ **E-004** — not provable from the repository |
| Restore drill | **No evidence of one ever being performed** → **F-057 (P2)** |
| Deploy rollback | Vercel supports instant rollback, but unverified (E-003) |
| Secret rotation | No documented procedure found |
| RPO / RTO | Not stated anywhere |

## 15.5 Domain

`peekalisting.com` has **no DNS, TLS or registrar evidence in the repository** (E-006). The repository is
still named `findit-marketplace` and `stagingCapabilityPolicy.js:10` keys trust off a
`findit-marketplace-stagi` hostname prefix, so even the intended canonical host is not asserted in code.
OAuth callbacks and Supabase Site URL: **E-006**.

## 15.6 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-054 | P1 | CONFIRMED | Staging deployment is failing, so the environment the capability model depends on is not being built |
| F-055 | P2 | CONFIRMED | Cloudflare edge layer is largely declared-but-unused; 4 of 7 Worker bindings are never referenced and no `wrangler.toml` is committed |
| F-056 | P2 | CONFIRMED | 59 of 159 migrations have no rollback script |
| F-057 | P2 | CONFIRMED | No evidence of a restore drill, and no stated RPO/RTO |
