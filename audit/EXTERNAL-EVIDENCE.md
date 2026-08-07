# EXTERNAL EVIDENCE REGISTER

Facts this repository cannot prove. Per Appendix D, **no external control is ever silently marked PASS.**

**Audited ref:** `origin/main` @ `ee6f212` · opened 2026-08-07

---

## E-000 — Live read-only infrastructure verification channel
**Status: BLOCKED**

The audit was scoped to include a live read-only evidence tier using the connected Supabase, Cloudflare and
Vercel MCP servers, to convert items E-001…E-006 from *unverified* into observed PASS/FAIL.

Every call returns `MCP error -32003: MCP tool call requires approval` without surfacing an approval prompt.
Attempted and blocked:

- `list_projects` (Supabase)
- `r2_buckets_list` (Cloudflare)

**Consequence:** all hosted/infrastructure facts below remain **EXTERNAL EVIDENCE REQUIRED**. Every
Appendix C infrastructure gate item will be marked accordingly rather than inferred from repository config,
per the operating rule that repository support is not proof of provisioning.

**How to unblock:** approve MCP tool access for this session, or supply the equivalent evidence manually
(console screenshots, `wrangler`/`supabase`/`vercel` CLI output).

---

## E-001 — Cloudflare edge Worker, R2, Queues, KV, Durable Objects
**Status: REQUIRED**

### Why repository evidence is insufficient
`workers/edge/src/index.ts:1-13` *declares* an `Env` binding surface — `LIGHTWEIGHT_JOBS` (Queue),
`PLATFORM_CONFIG` (KV), `RATE_LIMITS` (Durable Object), and three R2 buckets (`PEEK_SOURCE_MEDIA`,
`PEEK_DERIVATIVE_MEDIA`, `LISTING_MEDIA`). A TypeScript interface is a compile-time contract, not a
deployment. `infrastructure/cloudflare/` contains only `wrangler.toml.example`, `cloudflare.env.example`
and `provision-staging.sh`; **no committed `wrangler.toml`** exists, so not even the binding names are
pinned to real resources.

### Required evidence
- Deployed Worker name, environment and version for staging and production
- The three R2 buckets exist, with public/private access posture and any custom domain
- Queue `LIGHTWEIGHT_JOBS` exists with consumer concurrency and dead-letter configuration
- KV namespace `PLATFORM_CONFIG` and Durable Object `RATE_LIMITS` exist and are bound
- Confirmation `SUPABASE_SERVICE_ROLE_KEY` and `TURNSTILE_SECRET_KEY` are Worker secrets, not plaintext vars

### How to verify
1. `wrangler deployments list` per environment
2. `wrangler r2 bucket list`, `wrangler queues list`, `wrangler kv namespace list`
3. `wrangler secret list` for the Worker
4. Or Cloudflare dashboard → Workers & Pages → the Worker → Settings → Bindings

### Launch impact if unverified
Peek media processing, rate limiting and job fan-out are unproven. If the Queue or R2 buckets do not exist,
Peek fulfilment cannot complete and uploads have no durable destination — the core differentiator fails
silently in production.

---

## E-002 — Media processing worker deployment
**Status: REQUIRED**

### Why repository evidence is insufficient
`workers/media/Dockerfile` and `README.md` describe a containerised processor. Nothing in the repository
shows where (or whether) it runs, or how it is invoked.

### Required evidence
- Hosting target, running revision, and health endpoint
- Concurrency, timeout and retry bounds
- Whether invocation is `github-actions` or `external` (`FINDIT_TOUR_PROCESSOR_MODE`, `validate-env.mjs:76-100`)
- `TOUR_PROCESSOR_URL` / `TOUR_PROCESSING_CALLBACK_URL` resolve over HTTPS with a valid certificate

### How to verify
1. Identify the platform, then list running revisions and recent logs
2. Curl the health endpoint
3. Confirm secrets `TOUR_PROCESSOR_SECRET` and `FINDIT_TOUR_PROCESSING_WORKER_SECRET` are set

### Launch impact if unverified
Peeks would upload but never transition out of processing, so nothing would auto-publish.

---

## E-003 — Vercel project, environment separation and deployment protection
**Status: REQUIRED**

### Why repository evidence is insufficient
`vercel.json` sets build/routing/header behaviour but proves nothing about which project consumes it, which
environment variables are set per target, or whether preview deployments are isolated from production data.
**Preview writing to production is a P0 per Appendix A** and cannot be assessed from the repository.

### Required evidence
- Project id/name and the production domain it serves
- Environment variables per target (Production / Preview / Development), specifically the `VITE_SUPABASE_URL`
  used by Preview versus Production
- Deployment protection settings for preview URLs
- Whether `VITE_FEATURE_TOURS` is set for Production (decides F-003)

### How to verify
1. `vercel project ls`, then `vercel env ls` per environment
2. Dashboard → Project → Settings → Environment Variables, and → Deployment Protection
3. Compare the Preview `VITE_SUPABASE_URL` against the Production value — they must differ

### Launch impact if unverified
If Preview points at the production Supabase project, every preview deployment writes production data — P0.

---

## E-004 — Supabase staging and production projects
**Status: REQUIRED**

### Why repository evidence is insufficient
159 migrations and 101 rollback scripts define an *intended* schema. They do not prove which projects exist,
that migrations were applied, that hosted schema matches the ledger, or that staging and production are
separate. `docs/MIGRATION_LEDGER.md` is a repository claim, not hosted state.

### Required evidence
- Distinct project refs for staging and production
- Applied migration list per project, reconciled against `supabase/migrations/`
- Security advisor output (RLS-disabled tables, exposed views, function search_path warnings)
- Auth settings: email confirmation, password policy, MFA enrolment, OAuth redirect allowlist
- PITR / backup configuration and retention window

### How to verify
1. `supabase projects list`
2. `supabase migration list --linked` per project
3. Dashboard → Advisors → Security, and → Database → Backups
4. Or MCP `list_projects`, `list_migrations`, `get_advisors` once E-000 is unblocked

### Launch impact if unverified
The entire Phase 3 RLS conclusion would rest on migration source only. A table whose RLS was disabled by a
hotfix directly on the hosted database would be invisible to this audit.

---

## E-005 — Turnstile / bot protection
**Status: REQUIRED**

### Why repository evidence is insufficient
`supabase/functions/verify-turnstile/index.ts` implements verification; whether a Turnstile site exists,
which hostnames it allows, and whether the secret is configured is external state.

### Required evidence
- Turnstile site key/secret provisioned; `TURNSTILE_ALLOWED_HOSTNAMES` and `TURNSTILE_ALLOWED_ORIGINS` values
- Which flows actually enforce it (signup, listing creation, contact reveal, reporting)

### How to verify
1. Cloudflare dashboard → Turnstile → widget configuration
2. Confirm the Edge Function secret is set and exercise a flow with a deliberately invalid token

### Launch impact if unverified
Abuse-limited flows may be unprotected; assessed together with Phase 6 rate limiting.

---

## E-006 — peekalisting.com DNS, TLS, OAuth callbacks and email authentication
**Status: REQUIRED**

### Why repository evidence is insufficient
The repository contains no DNS zone, certificate or registrar configuration. The expected production domain
is `peekalisting.com`; the repository still carries `findit-marketplace` naming throughout, so even the
intended canonical host is not evidenced in code.

### Required evidence
- Apex and `www` resolution, redirect direction, and canonical host choice
- TLS certificate issuer, validity and coverage of all served hostnames
- Supabase Auth **Site URL** and **Redirect URLs** matching the production origin
- OAuth provider callback URLs (Google; Apple if enabled) matching production
- SPF, DKIM and DMARC records for whichever domain sends transactional mail

### How to verify
1. `dig +short peekalisting.com A` and `dig +short www.peekalisting.com CNAME`
2. `curl -sSI https://peekalisting.com` and inspect the certificate chain
3. Supabase dashboard → Authentication → URL Configuration
4. `dig +short TXT peekalisting.com` and `dig +short TXT _dmarc.peekalisting.com`

### Launch impact if unverified
Mismatched Site URL or OAuth callbacks break sign-in and password recovery on the production origin.
Missing SPF/DKIM/DMARC sends verification and recovery mail to spam, which silently breaks signup.
