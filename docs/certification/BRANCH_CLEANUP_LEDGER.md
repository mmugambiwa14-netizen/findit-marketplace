# Branch Cleanup Ledger

Updated: 2026-08-13
Canonical source of truth: `main`
Promotion PR: `#34`
Promotion merge: `c7ea23d1465aa37e9e0481a9874fffb21e86ffdd`

This ledger prevents historical branches from being treated as active product lines. New PeekaListing product work starts from `main` only.

## Canonical

- `main` — sole canonical product branch.
- `cloudflare-staging-ready` — active Cloudflare staging candidate; do not delete while staging acceptance is in progress.

## Temporary identical alias

- `integration/complete-current-stage` — certification branch used by PR #34. After merge it was fast-forwarded to canonical `main` and verified identical. Deleted from `origin` on 2026-08-13.

## Retain only for rollback provenance

- `backup/main-pre-production-promotion-2026-08-05` — retain until the first production release and rollback window close, then delete.

## Reconciled but deliberately not merged wholesale

- `feature/peek-threads-phase-3` / PR #4 — older Supabase Realtime conversation implementation conflicts with the current bounded polling/refetch messaging architecture. Preserve only as Git history; do not resume product work from it.
- `feature/contextual-permissions` / PR #5 — the old branch package is superseded by the newer contextual permission implementation already active on `main`, including camera education/recovery plus shared location and notification permission foundations. Do not merge the old branch wholesale.
- `develop` — reviewed safe packages were ported through controlled integrations. The branch also contains stale Peek deletions and superseded deployment/recommendation assumptions. Never merge wholesale.
- `continuation/contract-gate-repair` — relevant repository-hygiene and Peek Request repair content is already represented on `main`; historical commit ancestry is not required.
- `integration/peek-fulfilment-journey-certification` — historical ancestry differs, but the fulfilment migrations/contracts are present on `main` and current journey certification passes.

## Reconciled and safe to delete

These branches are already contained, superseded, or independently re-certified by canonical `main`:

- `brand/peekalisting-binoculars`
- `continuation/release-certification-ci`
- `integration/behaviour-security-tests`
- `integration/buyer-journey-certification`
- `integration/cloudflare-provisioning`
- `integration/critical-high-infrastructure`
- `integration/develop-security-reconciliation`
- `integration/final-release-certification`
- `integration/final-security-certification-gates`
- `integration/input-and-url-security-tests`
- `integration/listing-publication-journey-certification`
- `integration/mfa-auth-reconciliation`
- `integration/peek-fulfilment-journey-certification`
- `integration/safety-operations-journey-certification`
- `integration/security-boundary-tests-2`
- `integration/verified-business-journey-certification`
- `feature/listing-intelligence-foundation`
- `feature/curated-business-marketplace`
- `preview/integration`
- `release/production-readiness-2026-08-05`
- `continuation/contract-gate-repair`
- `claude/base-rpc-boundary-repair`
- `claude/findit-hardening-listing-012cf0`
- `claude/peekalisting-handoff-vklm8s`
- `claude/repo-code-review-fu5wgc`

The old feature branches listed in the previous section are also eligible for deletion once their historical value is no longer needed; their code must not be treated as newer than `main` merely because Git reports unique historical commits.

## Closed controlled reconciliation packages

- PR #3 / `continuation/release-certification-ci` — replaced by the current release certification system.
- PR #6 / `claude/repo-code-review-fu5wgc` — security, MFA and database work was ported through controlled reconciliation; direct merge remains unsafe.
- PR #7 / `brand/peekalisting-binoculars` — canonical logo, wordmark, browser metadata, PWA identity and service-worker branding are on `main`.
- PR #34 / `integration/complete-current-stage` — merged after full current-stage repository/database/journey certification and canonical preview promotion.

## Preview branch rule

GitHub Pages must deploy from `main` only through `.github/workflows/peekalisting-preview.yml`.

The legacy Pages workflows are absent. Historical preview branches must never be re-enabled as Pages deployment sources.

## Dependabot branches

Close or merge through normal dependency review; do not treat them as product source branches.

## External limitation

Remote branch cleanup was completed through the authenticated Git remote on 2026-08-13. The one-shot `cert/*` branches, the reconciled branches listed above, and the merged lock-metadata branch were deleted from `origin`. The backup branch remains intentionally until the first production release and rollback window close. Future branch deletion should continue to use an explicit, reviewed ref list; it must not remove `main`, the active staging candidate, an open-PR head, or an active worktree branch.

The same cleanup removed these additional merged or status-only refs after a live open-PR check:

- `certification/unified-base-20260810`
- `claude/peekalisting-remediation-handoff-d1mr2x`
- `deployment-status`
- `feature/canonical-taxonomy-foundation`
- `feature/web-push-notifications`
- `unified-certification-status`

Unique-history branches remain only where they are still useful as active work,
open-PR material, rollback provenance, or unreconciled feature history.
