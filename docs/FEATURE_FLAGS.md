# Feature Flags

Reviewed: 2026-07-29

## V1 enabled

| Flag | State | Dependency |
|---|---:|---|
| `VITE_FEATURE_BUSINESS_PROFILES` | `true` | Supabase profiles, trusted logo storage |
| `VITE_FEATURE_MESSAGING` | `true` | Conversations/inquiries RPC and RLS |
| `VITE_FEATURE_ESSENTIAL_NOTIFICATIONS` | `true` | Five-event notification RPCs and expiry worker |

These flags passed contract, SQL and hosted API/Storage/worker acceptance. The
staging deployment workflow enables them. They must all be `true` in a V1
production build.

## Peek release boundary

The accepted release sets `VITE_FEATURE_TOURS=true`,
`TOURS_BACKEND_ENABLED=true`, and `FINDIT_TOURS_WORKERS_ENABLED=true`.
Source defaults remain closed so an incomplete ad hoc deployment cannot expose
uploads without processing, cleanup, cache, and observability workers. Release
CI builds the complete Peek variant, and hosted activation leaves all runtime
layers enabled only after the acceptance workflow passes.

## V1 disabled

Payments, subscriptions, escrow, premium listings, AI moderation, AI
ban-evasion detection, AI ticket triage, AI support chat, scheduled reminders,
and marketing email must all be `false`. Production environment validation
fails closed if any is enabled.

## Activation process

1. Approve product scope and operational owner.
2. Implement server/data/storage boundaries and RLS.
3. Add contract, SQL, adversarial API and browser tests.
4. Configure providers/secrets without exposing them to Vite.
5. Pass production environment validation and build.
6. Enable in staging, observe, then approve production.

Flags do not make missing architecture safe. No deferred feature may be enabled
by changing a browser variable alone.
