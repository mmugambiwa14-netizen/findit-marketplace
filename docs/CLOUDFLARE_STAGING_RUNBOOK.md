# PeekaListing Cloudflare Pages staging runbook

## Purpose

This runbook deploys and certifies the PeekaListing web/PWA staging build on
Cloudflare Pages without changing public production traffic. Supabase remains
the backend for Database, Auth, Storage, Realtime and Edge Functions.

Cloudflare R2, Stream, Images, D1, Queues, Durable Objects, KV and Hyperdrive
are not prerequisites for the Pages migration. Do not grant their permissions
to the Pages CI token.

## Deployment authority

- GitHub environment: `cloudflare-staging`
- Pages project: `peekalisting-staging`
- Pages production branch: `staging`
- Canonical origin: `https://staging.peekalisting.com`
- Runtime: Node 24
- Deployment workflow: `.github/workflows/peekalisting-preview.yml`

The isolated staging project intentionally uses its Cloudflare **Production**
environment for the stable `staging` branch and its **Preview** environment for
other preview uploads. This does not make it the public production project.

## Required GitHub configuration

The protected `cloudflare-staging` environment contains:

- variable `CLOUDFLARE_ACCOUNT_ID`;
- secret `CLOUDFLARE_API_TOKEN` with only Account / Cloudflare Pages / Write;
- variable `FINDIT_EXPECTED_PROJECT_REF`;
- variable `VITE_SUPABASE_URL`;
- secret `VITE_SUPABASE_ANON_KEY` or browser-safe publishable key;
- restricted MapTiler browser configuration when map verification is enabled.

Never store a Cloudflare token, Supabase service-role key, Supabase secret key,
provider secret or worker signing secret under a `VITE_*` name.

## Deploy and certify

Run the manual Cloudflare staging workflow with the expected confirmation. It
must:

1. use Node 24;
2. validate the exact staging Supabase project ref;
3. build the PWA and scan the emitted bundle for secrets;
4. preserve `public/_headers` and `public/_redirects`;
5. upload only to `peekalisting-staging`;
6. patch the Cloudflare Preview and Production environment bindings after the
   Wrangler upload;
7. confirm that `staging.peekalisting.com` is active;
8. run hosted SPA, PWA, security-header, OAuth, listing, Peek, map, share-card
   and Supabase-connectivity checks.

Wrangler applies file-managed variables while uploading. The post-upload
environment patch is therefore required; moving it before deployment can erase
`SUPABASE_URL` and apply the wrong logical environment label.

## Traffic boundary

Do not attach `peekalisting.com` or `www.peekalisting.com` to the staging
project. Do not change apex DNS while certifying staging. Public host cutover is
allowed only after the separate production project and production Supabase
backend pass their complete acceptance gates.
