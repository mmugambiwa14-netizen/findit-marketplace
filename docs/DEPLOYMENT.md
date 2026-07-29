# Deployment

## Current deployment status — 2026-07-29

Supabase staging and the GitHub Pages staging frontend are deployed. GitHub
Actions executes the migration, recommendation database, release and Pages
workflows. All four PR checks and the Pages deployment passed on listing
intelligence head `cdba0ce`.

Staging frontend:
`https://mmugambiwa14-netizen.github.io/findit-marketplace/`

Staging Supabase: `FindIt Staging` (`bwgklpxoetrrkutottdb`). The production
project `FindIt Marketplace` (`jvbpxnfxkptuexgssplj`) was inspected only and
was not changed.

The Pages workflow builds with the repository subpath, uses a generated
same-origin SPA fallback, and restores direct routes through a 200 shell before
React mounts. Fresh desktop and mobile browser profiles passed canonical
listing, contextual recommendation, recently-listed, hydration, navigation and
overflow checks on the exact deployed commit.

Status: backend and Phase 4 frontend are staging-certified, not production
certified. The canonical operational procedure is
[`DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md).

Before deployment, every pre-deployment, data/rollback, security, storage and
workflow gate in the runbook must pass. Current clean-checkout and hosted
staging evidence proves full typecheck, Base44 elimination, Auth/RLS,
marketplace domains, private V1 media, recommendation delivery and worker
behavior. Remaining release work includes hosted Auth redirect certification,
production SMTP and monitoring, provider-native recovery, a production domain,
Phases 5 through 7, and an explicit production launch decision.
