# Cloudflare Pages deployment

Cloudflare Pages is the authoritative web host. Supabase remains the backend.
Staging is isolated in the `peekalisting-staging` Pages project and is served
from `https://staging.peekalisting.com`. The production project remains
`peekalisting`; the apex domain is not attached during staging acceptance.

## GitHub environments

The staging workflow uses the protected `cloudflare-staging` environment:

- Variables: `CLOUDFLARE_ACCOUNT_ID`, `VITE_SUPABASE_URL`
- Secrets: `CLOUDFLARE_API_TOKEN`, `VITE_SUPABASE_ANON_KEY`

The environment-specific `VITE_SUPABASE_*` entries are configured. The
repository-level `FINDIT_SUPABASE_*` names remain a temporary compatibility
fallback for staging only. Production never uses that fallback.

Production uses a separate protected `cloudflare-production` environment with
separate Supabase values, a `main`-only deployment policy and a required owner
review. The production environment exists, but promotion remains blocked until
its backend, OAuth, map-provider and notification gates pass.

Only `VITE_SUPABASE_URL` and the public Supabase anon/publishable key may be
used in the browser build. Never put service-role keys, secret keys, provider
secrets, or Cloudflare tokens in a `VITE_*` variable.

## Staging

Run **Deploy staging to Cloudflare Pages** and enter `DEPLOY`. The workflow:

1. Uses Node 24 and the locked dependencies.
2. Validates environment values and builds `dist`.
3. Verifies headers, SPA redirects, PWA artifacts, and bundle secret rules.
4. Creates or confirms the isolated `peekalisting-staging` Pages project.
5. Uploads its `staging` production branch with staging-only bindings.
6. Creates or confirms only the `staging.peekalisting.com` custom domain.
7. Verifies hosted routes, PWA assets, security headers, and Supabase Auth connectivity.

Staging acceptance passed on 2026-08-09. Do not point `peekalisting.com` at
Cloudflare until the separate production backend and hosted production
acceptance checks also pass. Staging credentials must not be substituted into
production merely to bypass this gate.
