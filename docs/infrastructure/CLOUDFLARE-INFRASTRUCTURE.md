# PeekaListing infrastructure — Cloudflare + Supabase

**Status:** staging certified; production held behind release gates

**Authoritative web host:** Cloudflare Pages

**Backend:** Supabase
**Last live verification:** 2026-08-09

```text
GitHub Actions → Cloudflare Pages → PeekaListing Web/PWA → Supabase
```

## Live Cloudflare inventory

| Resource | State |
|---|---|
| Account | `fdcf3559c23354c2aadbb6ae5f612744` |
| Staging Pages project | `peekalisting-staging`; production branch `staging` |
| Staging domain | `https://staging.peekalisting.com`; active |
| Staging deployment | commit `6570357`; hosted acceptance passed |
| Production Pages project | `peekalisting`; production branch `main` |
| Production deployment | none yet |
| Production custom domains | none attached |
| DNS | proxied `staging` CNAME points to `peekalisting-staging.pages.dev` |
| Apex / `www` | intentionally not routed while production gates are red |
| Mail DNS | existing MX, DKIM and Google verification records preserved |
| Git connection | neither Pages project uses Cloudflare Git integration; GitHub Actions is deployment authority |

Zone edge policy is also explicit: Always Use HTTPS is enabled, the minimum TLS
version is 1.2, TLS 1.3 is enabled and Automatic HTTPS Rewrites is enabled.
The Universal SSL certificate covering `peekalisting.com` and
`*.peekalisting.com` is active. HSTS remains repository-owned through
`public/_headers`, where it is verified on each hosted deployment.

The Pages projects are deliberately separate. Preview or staging uploads must
never target `peekalisting`, and production uploads must never target
`peekalisting-staging`.

Cloudflare R2, Stream, Images, D1, Queues, Durable Objects and Hyperdrive are
not required for this migration. Supabase remains the database, Auth, Storage,
Realtime and Edge Functions backend. Optional Cloudflare products must not be
enabled merely to complete the web-host migration.

## Live Supabase inventory

| Environment | Project | State | Readiness snapshot |
|---|---|---|---|
| Staging | `bwgklpxoetrrkutottdb` | active/healthy | 162 migrations, 30 Edge Functions, Google OAuth enabled, populated test catalogue |
| Production | `jvbpxnfxkptuexgssplj` | active/healthy | 57 migrations, 15 Edge Functions, no users/data/storage objects, Google OAuth disabled, Site URL still localhost |

The dedicated production project is real, but it is not release-ready. Do not
substitute staging credentials into production to make the gate pass. That
would mix test and public data, break environment isolation and make a later
backend cutover harder.

## Environment authority

| Layer | Staging | Production |
|---|---|---|
| GitHub environment | `cloudflare-staging` | `cloudflare-production` |
| Allowed deployment branch | manual staging workflow | `main` only, required owner review |
| Pages project | `peekalisting-staging` | `peekalisting` |
| Logical runtime label | `staging` | `production` |
| Supabase ref | `bwgklpxoetrrkutottdb` | `jvbpxnfxkptuexgssplj` |
| Canonical origin | `staging.peekalisting.com` | `peekalisting.com` |

GitHub stores the Supabase URL as an environment variable and the browser-safe
publishable key as an environment secret. The Cloudflare token is a server-side
CI secret. Service-role keys, Supabase secret keys, provider secrets and
Cloudflare tokens must never use a `VITE_*` name.

Wrangler applies file-managed variables during an upload. Therefore each
deployment workflow patches `DEPLOYMENT_ENV`, `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` after `wrangler pages deploy`. Reversing that order
silently erases `SUPABASE_URL` and mislabels the isolated staging project.

## Staging evidence

The 2026-08-09 hosted verifier passed on `https://staging.peekalisting.com` for:

- direct routes and SPA fallback;
- PWA manifest, service worker and install boundary;
- CSP, HSTS, frame denial, MIME protection, referrer and permissions policies;
- Google OAuth redirect generation;
- listing discovery and category counts;
- Peeks;
- maps and vendored MapLibre assets;
- listing-specific WhatsApp/Open Graph cards;
- Supabase Auth, REST, RPC and Edge Function connectivity.

`public/_headers` and `public/_redirects` remain the repository-owned Pages
boundary and must be preserved.

## Production release gate

The production workflow is manual, uses Node 24, accepts only `PROMOTE`, and is
restricted to `main` with required owner review. Before upload it must pass:

1. environment validation, including the exact guarded Supabase project ref;
2. Google OAuth provider verification;
3. the production build and bundle-secret checks;
4. Cloudflare security-header and SPA/PWA contracts.

After upload, a production candidate must pass the same hosted journeys as
staging before adding either production custom domain.

Current production blockers are not Cloudflare defects:

- the production Supabase schema and Edge Functions are behind staging;
- production Google OAuth is not configured;
- production contains no accepted catalogue, Peeks, users or media;
- production backend secrets and provider delivery have not been certified;
- the production Cloudflare API token is not yet present in the protected
  GitHub environment;
- the required restricted MapTiler browser key and notification worker secret
  are not yet present.

## DNS cutover and rollback

Do not attach `peekalisting.com` or `www.peekalisting.com`, and do not create
their Pages DNS records, until the production candidate passes its hosted
acceptance checks. When it does:

1. attach `peekalisting.com` to the `peekalisting` Pages project;
2. attach `www.peekalisting.com` and redirect it to the apex;
3. verify certificates and DNS are active;
4. rerun routing, PWA, headers, OAuth, Supabase and product-journey checks on
   the apex;
5. keep the last known-good Pages deployment available for rollback.

Rollback is a Pages deployment promotion or, if the custom domain itself is at
fault, detaching the production hostname. No database rollback is part of a
frontend rollback.

## Remaining Vercel authority

The repository has removed `vercel.json` and Vercel-specific runtime detection,
but the Vercel GitHub App is still connected and continues to create `Vercel`
and `Vercel Preview Comments` checks on PR #60. Disconnect that project/repo
integration only after Cloudflare staging is re-certified from the final
workflow commit. Preserve the old Vercel project temporarily as rollback
evidence; it does not remain a deployment authority.
