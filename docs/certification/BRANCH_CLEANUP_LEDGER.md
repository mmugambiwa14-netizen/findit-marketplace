# Branch Cleanup Ledger

Updated: 2026-08-07
Canonical source of truth: `main`

This ledger prevents historical branches from being treated as active product lines. Branch deletion must occur only after the final release-certification PR merges and any explicitly retained package is reconciled.

## Keep

- `main` — sole canonical product branch.
- `integration/final-release-certification` — temporary active Stage 6 branch; delete after merge.
- `backup/main-pre-production-promotion-2026-08-05` — retain until the first production release and rollback window close.

## Retain temporarily for isolated reconciliation

- `feature/peek-threads-phase-3` / PR #4 — contains a unique five-file real-time conversation update package. Do not merge wholesale; port only if current messaging certification shows it is still required.
- `feature/contextual-permissions` / PR #5 — contains a unique contextual camera-permission education package. Explicitly deferred from the release-certification milestone and must be rebased or ported separately.

## Closed after controlled reconciliation

- PR #3 / `continuation/release-certification-ci` — replaced by the Stage 6 release workflow.
- PR #6 / `claude/repo-code-review-fu5wgc` — security, MFA and database work was ported through controlled PRs #21–#26; direct merge is unsafe.
- PR #7 / `brand/peekalisting-binoculars` — canonical logo, wordmark, browser metadata, PWA manifest, service-worker identity and push fallbacks were ported into PR #32.

## Safe to delete after Stage 6 merge

These branches represent work already merged or reconciled into canonical `main`:

- `brand/peekalisting-binoculars`
- `continuation/release-certification-ci`
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
- `preview/integration`
- `release/production-readiness-2026-08-05`
- `continuation/contract-gate-repair`
- `claude/base-rpc-boundary-repair`
- `claude/findit-hardening-listing-012cf0`
- `claude/peekalisting-handoff-vklm8s`
- `claude/repo-code-review-fu5wgc`

## Dependabot branches

Close or merge through normal dependency review; do not treat them as product source branches.

## External limitation

The current GitHub connector cannot delete branch refs. Actual deletion remains a GitHub UI/CLI action after PR #32 is merged.
