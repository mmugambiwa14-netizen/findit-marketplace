# Prompt for a New Codex Session

Paste everything below into a new Codex session.

---

Continue the FindIt project from the exact current machine state. Work
autonomously and sequentially, completing everything that can be completed
without asking me. Ask only when a genuinely external decision or unavailable
credential makes further safe progress impossible.

The primary project is located at:

```text
C:\Users\mmuga\OneDrive\Desktop\FindIt-Extensive-Product-Audit-Remediated-v2-2026-07-27
```

The private GitHub repository is:

```text
https://github.com/mmugambiwa14-netizen/findit-marketplace
```

Start by reading this authoritative handoff:

```text
C:\Users\mmuga\OneDrive\Desktop\FindIt-Extensive-Product-Audit-Remediated-v2-2026-07-27\docs\CODEX_CURRENT_HANDOFF_2026-07-29.md
```

Important current state:

```text
main and origin/main are at 780a145eb00f5e957437d4e1b8c5b33999809672.
The primary main worktree contains intentional uncommitted logo changes.
Do not reset, clean, stash, overwrite, or switch branches in that worktree.

The newer backend work is on:
feature/listing-intelligence-foundation
head 9fa6711c71e19f56f51efb6b18056dbaf8404abb
draft PR #1
https://github.com/mmugambiwa14-netizen/findit-marketplace/pull/1

The branch is 189 commits ahead of main and all four current CI checks pass.
Keep the PR draft. Do not merge it.
```

Use a separate Git worktree based on the current remote feature branch for all
edits. Confirm the remote head before changing files. Preserve and work with
any changes you did not create.

Supabase current state:

```text
Authenticated organization: pyktbmobvwktiuiqbobd

FindIt Staging:
bwgklpxoetrrkutottdb
ACTIVE_HEALTHY

FindIt Marketplace:
jvbpxnfxkptuexgssplj
ACTIVE_HEALTHY
currently linked by the local Supabase CLI

The older handoff target mfapduvnlcmmevrqjbis is not visible in the current
account. Do not deploy to it.
```

Before any hosted change, perform a non-destructive audit of the two visible
FindIt projects and reconcile the target with the repository scripts and docs.
Do not print, commit, or disclose credentials.

Your objective is to make the listing-intelligence branch genuinely executable
and staging-certifiable, not merely green under static tests.

Complete this sequence:

1. Reproduce and fix the public Edge Function authentication mismatch. The six
   anonymous recommendation services and `contextual-ecosystem` currently use
   `verify_jwt=true`, but the browser uses `sb_publishable_*`, which is not a
   JWT. Keep `personalized-recommendations` authenticated.
2. Fix `contextual-ecosystem` browser CORS. It currently omits `authorization`
   and `x-client-info`. Prefer Supabase's maintained CORS headers.
3. Replace recommendation runtime's legacy-only `SUPABASE_ANON_KEY` lookup with
   the existing FindIt helper pattern that supports
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, and the legacy
   fallback.
4. Fix server-side cancellation. The contextual RPC passes an unsupported
   `{ signal }` option, and recommendation/identity timeouts only stop waiting.
   Use real abort signals on the underlying requests.
5. Make circuit-breaker outcome persistence reliable with
   `EdgeRuntime.waitUntil` or an evidence-based awaited alternative.
6. Add Edge Function typechecking to CI so invalid Supabase SDK usage fails a
   gate.
7. Repair hosted certification. Test the actual browser headers, CORS preflight,
   adapter body, Edge validation, PostgREST named arguments, response contract,
   authenticated personalization, timeout behavior, and fail-soft behavior.
   Include `contextual-ecosystem`.
8. Document all required server variables, including
   `FINDIT_REQUEST_BUDGET_SALT`, `FINDIT_CONTEXTUAL_HEALTH_SECRET`, and
   `FINDIT_RECOMMENDATION_HEALTH_SECRET`, without recording real values.
9. Correct the stale feature-branch handoff: head, Node version, hygiene count,
   function enabled state, machine paths, and Supabase target.
10. Add branch protection or clearly report if repository permissions prevent
    it. The four green checks currently are not enforced.
11. Run all local release gates. The Windows-only CRLF test should be made
    portable by normalizing line endings without weakening its assertion.
12. After local and CI gates pass, deploy only to the confirmed staging target.
    Keep all recommendation policies disabled for the first transport smoke.
13. Run hosted migrations, Edge deployment, health checks, anonymous browser
    calls, authenticated calls, CORS tests, failure injection, and circuit
    persistence checks.
14. Enable exactly one non-personalized recommendation service in staging and
    certify that it returns real data while listing pages continue to work when
    the service is unavailable.
15. Only then begin Phase 4 and wire recommendation/contextual adapters into the
    listing-detail UI with loading, empty, error, retry, mobile, accessibility,
    analytics, and failure-isolation states.
16. Keep maps, search, listings, Peek, authentication, messaging, seller tools,
    and moderation independent from recommendation availability.
17. Update PR #1 and the handoff after material progress. Keep source-complete,
    locally tested, CI-passed, hosted-deployed, and production-certified claims
    separate.

Current known verification:

```text
Feature branch CI: all four checks green.
Local lint: pass.
Local typecheck: pass.
SQL boundary: pass, 68 migrations and 39 rollback capsules.
Repository hygiene: pass, 644 files.
Source graph: pass, 358 modules and 0 unresolved.
Product surface audit: pass, 0 failures and 1 warning.
Production build: pass and within budget.
Contracts: 307/308 locally because one test assumes LF; Linux CI passes it.
No current hosted recommendation transport has been certified.
All seven service policies are disabled.
The adapters are not consumed by the UI.
Phases 4 through 7 are not complete.
```

Do not stop at a plan. Implement, test, inspect the running application on
desktop and mobile viewports, verify hosted behavior where safe, and continue
until the next genuinely blocked external action. At the end, report:

```text
files changed
commits created
branch and PR state
local test results
CI results
Supabase target used
hosted tests executed
what is now user-visible
remaining blockers with exact evidence
```

---

