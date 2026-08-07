# FLOW-12 — Favourites / saved listings
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/saved` (auth, `App.jsx:188`) → `Saved.jsx` → `favouritesRepository` → direct `.from('saved_listings')` (`:6,23,38,58,76`) under RLS.

## Assessment
| Aspect | State |
|---|---|
| Auth required | PASS — route is behind `ProtectedRoute`; no guest favourites |
| Authorization | RLS on `saved_listings` (Phase 3 matrix) |
| Deleted listings | `saved_listings` FKs to `listings`; listing delete cascades |
| Access pattern | Direct table access rather than an RPC — acceptable here because the row is owned by the caller and carries no third-party PII |

## Gaps
- No optimistic-update or dedupe evidence traced at repository level; UI behaviour on rapid toggle is unverified in this static pass. Marked **UNVERIFIED — needs check** (requires a running app).
