# Branch Cleanup Ledger

Updated: 2026-08-07
Canonical source of truth: `main`

This ledger prevents historical branches from being treated as active product lines. Branch deletion must occur only after the final release-certification PR merges and any explicitly retained package is reconciled.

## Keep

- `main` — sole canonical product branch.
- `integration/final-release-certification` — temporary active Stage 6 branch; delete after merge.
- `backup/main-pre-production-promotion-2026-08-05` — retain until the first production release and rollback window close.

## Retain temporarily for isolated reconciliation

- `feature/peek-threads-phase-3` / PR #4 — contains a unique real-time conversation update package. Do not merge wholesale; reconcile only the five-file live messaging delta if it remains necessary.
- `feature/contextual-permissions` / PR #5 — contains a unique contextual camera-permission education package. Rebase or port onto current `main` as a separate product change.
- `brand/peekalisting-binoculars` / PR #7 — contains unique PeekaListing logo/PWA assets and release-control documents. Reconcile against the current brand implementation before closing.

## Closed as superseded

- PR #3 / `continuation/release-certification-ci` — replaced by the Stage 6 release workflow.
- PR #6 / `claude/repo-code-review-fu5wgc` — security, MFA and database work was ported through controlled PRs #21–#26; direct merge is unsafe.

## Safe to delete after Stage 6 merge

These integration branches represent work already merged into canonical `main`:

- `integration/behaviour-security-tests`
- `integration/buyer-journey-certification`
- `integration/cloudflare-provisioning`
- `integration/critical-high-infrastructure`
- `integration/develop-security-reconciliation`
- `integration/final-security-certification-gates`
- `integration/input-and-url-security-tests`
- `integration/listing-publication-journey-certification`
- `integration/mfa-auth-reconciliation`
- `integration/peek-fulfilment-journey-certification`
- `integration/safety-operations-journey-certification`
- `integration/security-boundary-tests-2`
- `integration/verified-business-journey-certification`

## Historical branches requiring deletion after a final comparison

- `develop` — never merge wholesale; all accepted security work has been reconciled. Preserve only through Git history.
- `feature/listing-intelligence-foundation` — former source-of-truth branch, now superseded by `main`.
- `feature/curated-business-marketplace` — superseded by the verified-business flow in `main`.
- `integration/behaviour-security-tests`
- `preview/integration`
- `release/production-readiness-2026-08-05`
- `continuation/contract-gate-repair`
- `claude/base-rpc-boundary-repair`
- `claude/findit-hardening-listing-012cf0`
- `claude/peekalisting-handoff-vklm8s`
- `claude/repo-code-review-fu5wgc`

## Dependabot branches

Close or merge through normal dependency review; do not treat them as product source branches:

- `dependabot/github_actions/actions/checkout-7`
- `dependabot/github_actions/actions/configure-pages-6`
- `dependabot/github_actions/actions/upload-pages-artifact-5`
- `dependabot/npm_and_yarn/date-fns-4.4.0`
- `dependabot/npm_and_yarn/eslint-plugin-react-hooks-7.1.1`
- `dependabot/npm_and_yarn/multi-d8ec5a502f`
- `dependabot/npm_and_yarn/npm-minor-and-patch-c1243dba9d`
- `dependabot/npm_and_yarn/tailwindcss-4.3.3`

## External limitation

The current GitHub connector can create or move refs but cannot delete branch refs. Actual branch deletion remains a GitHub UI/CLI action after this ledger is approved and the final release-certification PR is merged.
