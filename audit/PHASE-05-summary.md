# PHASE 05 — END-TO-END JOURNEY AUDIT — SUMMARY

**Audited ref:** `origin/main` @ `ee6f212` · 20 flows traced in `audit/PHASE-05-flows/`.
Static + local evidence; hosted behaviour unverified (E-003/E-004).

## Verdict per flow

| # | Flow | Verdict | Principal gap |
|---|---|---|---|
| 01 | Discovery | **PASS** | Peek rail has no destination in production (F-003) |
| 02 | Authentication | **FAIL** | MFA is client-only (F-027) |
| 03 | Search | **PASS** | Mixed cursor/offset pagination (F-028) |
| 04 | Listing creation | **PASS — strongest flow** | Registry attributes never persisted (F-019/F-020) |
| 05 | Listing lifecycle | **PARTIAL** | No `sold` transition (F-029) |
| 06 | Listing detail | **PASS** | Thin attribute surface (F-021); FindIt copy (F-001) |
| 07 | Public Peek | **BLOCKED** | Not reachable in production (F-003) |
| 08 | Peek Request | **PASS** | `moderation_status` default hazard (F-026); wrong deep link (F-030) |
| 09 | Peek fulfilment | **PASS (logic)** | Its rollback script is what breaks all CI (F-012/F-013) |
| 10 | Contact reveal | **PASS — exemplary** | FindIt copy at the trust-critical moment (F-001) |
| 11 | Messaging | **PARTIAL** | No realtime and no refetch-on-focus (F-031) |
| 12 | Favourites | **PASS** | Optimistic/dedupe behaviour UNVERIFIED |
| 13 | Verified business | **PASS** | Decision-reason and notification legs UNVERIFIED |
| 14 | Services | **PASS** | Only 4 service categories |
| 15 | Notifications | **PASS** | Seller alert deep-links to the buyer page (F-030) |
| 16 | Reports & safety | **PASS** | All destructive actions reachable at aal1 (F-027) |
| 17 | Admin | **PARTIAL** | `/admin/peeks` semantics deferred to Phase 16 |
| 18 | PWA / offline | **PARTIAL** | Manifest icons unusable on iOS (F-017) |
| 19 | Static / legal | **FAIL** | Unfilled operator placeholders in live Terms and Privacy (F-011) |
| 20 | Errors | **PASS — better than typical** | Chunk-load not distinguished (F-016) |

## Cross-cutting observations

**1. The write layer is consistently well built.** Every core mutation goes through a `SECURITY DEFINER`
RPC carrying an ownership predicate, a row lock where concurrency matters, explicit SQLSTATEs, and an
idempotency or duplicate-suppression mechanism. Direct table writes are RLS-denied. Across 20 flows the
audit found **no IDOR and no missing ownership check**.

**2. The failure surface is unusually complete.** Differentiated states exist for render errors, bootstrap
failure, auth-provider unavailability, missing profile, blocked account, role-check failure and offline —
and "could not verify" is deliberately distinguished from "denied". No white-screen path was found.

**3. The gaps cluster in three places, not across the board:**
- **Presentation/identity** — FindIt branding and unfilled legal placeholders (F-001, F-011).
- **Release plumbing** — CI red, quality gates skipped, Peeks gated off (F-012, F-013, F-003).
- **Step-up authentication** — MFA not enforced server-side (F-027).

None of these are architectural defects in the marketplace logic itself.

**4. The core differentiator is the least-finished part.** Peek fulfilment is logically the most carefully
built state machine in the codebase — correct-seller-only, bounded retries, 48-hour expiry, stale-attempt
closure — yet Public Peeks cannot be reached in production (F-003), the seller has no top-level queue route
(F-030), its UI carries all 10 typecheck errors (F-014), its rollback script is what turns CI red
(F-012/F-013), and its processing worker deployment is unverified (E-002).

## New findings raised in Phase 5

| ID | Sev | Title |
|---|---|---|
| F-028 | P3 | Search mixes cursor pagination with an offset `.range()` path |
| F-029 | P2 | No `sold` transition — sellers can only mark a listing `unavailable` |
| F-030 | P2 | Seller Peek-request notification deep-links to the buyer page; no top-level seller queue route |
| F-031 | P2 | Messaging has no realtime and no refetch on focus or reconnect, so new messages can go unseen |

*(A suspected finding that `CreateService.jsx` was unrouted dead code was withdrawn: it is composed by
`CuratedCreateService.jsx:5`.)*
