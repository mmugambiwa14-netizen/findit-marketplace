# Cloudflare staging

Cloudflare Pages is the authoritative staging host. The Pages project is
`peekalisting`, and the canonical staging origin is:

`https://staging.peekalisting.pages.dev/`

The staging deployment runs from `cloudflare-staging-ready` through
`.github/workflows/peekalisting-preview.yml`, uses Node 24, builds with
`npm run build`, and publishes `dist` to the Cloudflare Pages `staging` branch.
The deployment must preserve `public/_headers` and `public/_redirects`.

Staging uses Supabase project `bwgklpxoetrrkutottdb`. Its Auth URL
configuration must use the Cloudflare staging origin as the Site URL and allow
the following application redirects:

- `https://staging.peekalisting.pages.dev/`
- `https://staging.peekalisting.pages.dev/**`

Localhost development redirects may remain allowlisted. Retired Vercel and
GitHub Pages origins must not be used as the staging Site URL or remain in the
staging redirect allowlist, because Supabase falls back to the Site URL after
authentication when a requested redirect is not accepted.

Only browser-safe Supabase publishable or legacy anonymous keys may be exposed
through `VITE_*`. Service-role keys, secret keys, provider secrets, Cloudflare
tokens, and Supabase management tokens must remain server-side secrets.

Do not attach `peekalisting.com` or change its DNS until staging acceptance has
passed for routing, PWA installation, security headers, Google sign-in,
listings, Peeks, maps, and Supabase connectivity.
