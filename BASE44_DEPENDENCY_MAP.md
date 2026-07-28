# Base44 Dependency Map

Final review: 2026-07-26
Current operational dependencies: **0**

The original Base44 inventory is preserved in Git commit `55a5807`. This file
records how each dependency class was disposed of in the current V1 repository.

| Original dependency | V1 disposition | Replacement | Verification |
|---|---|---|---|
| `@base44/sdk` and browser client | Removed | Supabase client plus domain services/repositories | Package lock scan, source elimination gate, broad typecheck, production build |
| Base44 Auth | Removed | Supabase Auth, profile trigger, protected route RPCs | Local Auth email flow and guarded hosted Auth/RLS smoke |
| Hosted entities | Removed from source export | 29 versioned Postgres migrations with RLS | Local pgTAP, hosted migration push/lint, hosted adversarial API suites |
| Listing/service/profile images | Removed | Two private Supabase buckets and authenticated upload functions | Hosted upload, sanitization, moderation, signed-read, replacement, cleanup tests |
| Hosted functions | Removed | Protected Postgres RPCs and four Edge Functions | Contract tests plus hosted admin, messaging, notification, upload and worker suites |
| Scheduled expiry/cleanup | Removed | Two independently authenticated Edge workers called by GitHub Actions | Hosted authorization, idempotency, cleanup and expiry-notification acceptance |
| Hosted agents and AI | Removed from V1 | No V1 replacement; feature remains intentionally deferred/off | Route/source removal and production flag gate |
| Payments/premium/subscriptions | Removed from V1 UI | No V1 provider; fail-closed dormant database records remain documented | Route graph and production flag gate |
| Legal, verification, rich support, bulk tools | Removed from V1 source | Future product redesign only | Unreachable-code removal, active graph/typecheck/build |
| App bootstrap/config | Removed | Standard Vite environment and Supabase configuration | Environment validator and independent build |
| Base44 export tree | Removed from working tree | Git history is the immutable archive | Elimination gate fails if `base44/` returns |

Remaining uses of the word “Base44” are historical migration documentation and
negative regression tests. They are not executable dependencies, credentials,
URLs, imports, or deployment configuration.
