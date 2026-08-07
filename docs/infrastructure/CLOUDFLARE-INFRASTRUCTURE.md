# PeekaListing Infrastructure — Cloudflare + Supabase

**Status:** provisioning in progress · **Authoritative hosting:** Cloudflare · **Vercel:** retired
**Last verified:** 2026-08-07 against the live Cloudflare and Supabase connectors

This is the single authoritative infrastructure document. Target architecture:

```text
GitHub ──► CI / certification ──► Cloudflare ──► PeekaListing Web / PWA ──► Supabase
```

---

## 1. Verified inventory

Everything below was read from the live connectors, not assumed.

### Cloudflare

| Resource | State |
|---|---|
| Account | reachable |
| Workers | **0 deployed** |
| KV namespaces | 2 — **provisioned by this pass**, see §2 |
| R2 | **not enabled** — `403 code 10042, "Please enable R2 through the Cloudflare Dashboard"` |
| Queues | not provisioned |
| Turnstile | unknown — no connector visibility |
| DNS / `peekalisting.com` zone | unknown — no connector visibility |
| Pages project | none created |

### Supabase — organization `kuda` (`pyktbmobvwktiuiqbobd`)

| Project | Ref | Region | State | Role |
|---|---|---|---|---|
| FindIt Marketplace | `jvbpxnfxkptuexgssplj` | eu-west-2 | **hibernated** | referenced only in `docs/` |
| FindIt Staging | `bwgklpxoetrrkutottdb` | eu-west-2 | active | referenced in **application source** |
| SMN Platform | `kdjylecotbspovxauvzd` | eu-west-1 | inactive | unrelated — do not touch |
| kudakwashe-mac's Project | `xvvrsqorjurygitnnjar` | ap-southeast-1 | inactive | unrelated — do not touch |

**A staging project already exists.** Do **not** create `peekalisting-staging`; that would be the redundant
second project the brief forbids.

---

## 2. Provisioned in this pass

Cloudflare KV, satisfying the `PLATFORM_CONFIG` binding declared in
`infrastructure/cloudflare/wrangler.toml.example`. Both are free-tier; no billing was activated.

| Namespace | ID |
|---|---|
| `peekalisting-platform-config-staging` | `ee31e4e3dfe0462286729f4140f4a654` |
| `peekalisting-platform-config-preview` | `9c71a8476be84009b5f5c59c81a83f4c` |

These are resource identifiers, not credentials. Substitute them for
`REPLACE_WITH_STAGING_NAMESPACE_ID` / `REPLACE_WITH_PREVIEW_NAMESPACE_ID` when generating a real
`wrangler.toml`.

Also already in the repository from the migration work: `public/_headers` and `public/_redirects` carry the
full production security posture (CSP, HSTS, Permissions-Policy, COOP/CORP, frame denial, cache policy, SPA
fallback), generated from `vercel.json` and enforced by `tests/cloudflareHeadersContracts.test.mjs`.

---

## 3. Two findings that block a safe cutover

### 3.1 Staging is 21 migrations behind

The repository has **165** migrations. `FindIt Staging` has **144** applied, ending at
`20260806021434_extend_alert_event_types_for_curated_marketplace`. The repository continues through
`20260807042300_restore_owner_transition_country_gate`.

The staging version stamps also do not match repository filenames — staging records
`20260806015228 enforce_curated_publishing_at_database_boundary` where the repository file is
`20260806070000_enforce_curated_publishing_at_database_boundary.sql`. So staging was not built purely from
this migration chain in this order.

**Staging cannot certify anything until it is rebuilt from the authoritative chain.** Do not hand-patch it.

### 3.2 The app's environment resolution is Vercel-coupled, and points at staging

`src/lib/supabaseClient.js:14-35` hardcodes the **staging** Supabase URL and publishable key as a fallback,
gated on `VITE_VERCEL_GIT_COMMIT_REF` and an allowlist of three branches
(`feature/listing-intelligence-foundation`, `claude/findit-hardening-listing-012cf0`,
`feature/peek-threads-phase-3`) — none of which is the current remediation branch.

On Cloudflare `VITE_VERCEL_GIT_COMMIT_REF` is never set, so `isStagingBranch` is permanently false and the
fallback is dead code. The practical consequences:

- Cloudflare deployments **must** supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` explicitly, or the
  client throws at startup (it already fails closed, which is correct).
- The hardcoded staging connection should be **removed** rather than re-pointed at a Cloudflare variable.
  Cloudflare Pages supports distinct Production and Preview environment variables, which is the mechanism
  §8 environment separation actually wants.

The same Vercel coupling runs through `src/lib/stagingCapabilityPolicy.js`, which gates **Peeks, messaging,
notifications and current-location**. Retargeting it is a security-relevant change to a capability gate and
is scoped as work, not done blind — see §6.

**No secret is exposed by either file.** The key is an `sb_publishable_` browser-public key, not a
service-role key. It is still wrong to pin an environment's connection in source.

---

## 4. Environment model (target)

| | LOCAL | STAGING / PREVIEW | PRODUCTION |
|---|---|---|---|
| Web | vite dev | Cloudflare preview deployment | Cloudflare production |
| Supabase | local CLI stack | `bwgklpxoetrrkutottdb` | to be confirmed (see §6) |
| `VITE_SUPABASE_URL` | `.env.local` | Cloudflare Preview var | Cloudflare Production var |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Cloudflare Preview var | Cloudflare Production var |

**Never expose through `VITE_*`:** the Supabase service-role key, Cloudflare API tokens, R2 secret
credentials, `MEDIA_SIGNING_SECRET`, `TURNSTILE_SECRET_KEY`. Every `VITE_*` value reaches the browser.
Worker-side secrets go through `wrangler secret put`, as `wrangler.toml.example` already documents.

Preview deployments must never target the production Supabase project.

---

## 5. External blockers — account owner required

Each blocks only its own subsystem. All other work continued around them.

### B-CF-1 — R2 not enabled
Connector returns `403 code 10042`. R2 bucket creation is impossible until enabled on the account.
Free tier: 10 GB storage, 1M Class A + 10M Class B operations/month. Enabling requires a payment method on
file even to use the free allowance. Blocks: `peekalisting-media-staging` / `-production`, the media
delivery path, and R2 bindings in `wrangler.toml`. **Postponable** — Supabase Storage remains operational
and must stay so until R2 is behaviour-proven.

### B-CF-2 — No connector coverage for DNS, Turnstile, Queues, Pages, or Worker deployment
The Cloudflare connector exposes only D1, KV, R2, Hyperdrive, read-only Workers, and documentation search.
It has **no** tools for zones/DNS records, Turnstile widgets, Queues, Pages projects, or deploying a Worker.
These cannot be provisioned programmatically from here regardless of permissions. They need either the
dashboard or a scoped Cloudflare API token supplied to CI so `wrangler` can act.

### B-CF-3 — Supabase production project identity unconfirmed
`FindIt Marketplace` is hibernated and its migration listing fails authentication through the connector.
It appears only in documentation, never in application source, so it cannot be confirmed as the live
production backend from the repository alone. **Do not cut any domain over until this is settled.**

---

## 6. Execution sequence

1. **Unblock R2 and issue a CI API token** (owner) — B-CF-1, B-CF-2.
2. **Rebuild staging from the authoritative migration chain** — §3.1. Synthetic data only; never copy
   production user data.
3. **Remove the Vercel-coupled Supabase fallback** from `supabaseClient.js` and retarget
   `stagingCapabilityPolicy.js` off `VITE_VERCEL_GIT_COMMIT_REF`, updating
   `tests/stagingCapabilityPolicy.test.mjs` and `tests/stagingFeatureParityContracts.test.mjs` with it.
4. **Create the Cloudflare Pages project** and wire GitHub → preview → production with per-environment
   Supabase variables.
5. **Turnstile** — provision widgets, then implement the server-side verification boundary. A client-only
   check is insufficient; `supabase/functions/verify-turnstile/index.ts` already exists as the server side.
6. **Queues and Workers** — only once R2 and the media path are real. `workers/edge/src/index.ts` already
   exports the handler and the `RateLimitCoordinator` Durable Object, and the config dry-run passes.
7. **DNS** — prepare `staging.peekalisting.com` first. Preserve MX, SPF, DKIM, DMARC and verification TXT
   records. Apex cutover only after §7 proof.
8. **Retire Vercel** — sequence in `audit/REMEDIATION-PROGRESS.md`: retarget
   `scripts/verify-deployment-security.mjs` and the five Vercel-referencing contracts **before** deleting
   `vercel.json`, since that verifier guards the headers the migration preserves.

---

## 7. Cutover gate

Do not point `peekalisting.com` at Cloudflare until all of these are proven on the Cloudflare origin:
production build, direct routes, SPA fallback, assets, PWA manifest, service worker, Supabase connectivity,
auth, listing discovery, listing detail, listing publication, Peeks, verified-business flow, messaging,
media, security headers present, no secrets exposed, and production variables pointing at production
services.

## 8. Rollback

Until the apex is cut over, rollback is DNS-free: the existing origin keeps serving. After cutover, revert
the apex/`www` records to the previous target. Cloudflare Pages retains prior deployments, so a rollback is
promoting the last known-good build. Supabase is unaffected by a web rollback — no destructive database
action is part of any cutover step.

## 9. Do not touch

`--findit-*` CSS custom properties, `__findit_*` browser storage keys, `deleteFindItCaches()`, and the
`findit-marketplace` repository name. These intentionally retain the old prefix
(`audit/REMEDIATION-PROMPT.md` §2.1, §3.3). The two inactive Supabase projects are unrelated to
PeekaListing.
