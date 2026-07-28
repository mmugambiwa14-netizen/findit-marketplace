# Feature Flags

Reviewed: 2026-07-26

## V1 enabled

| Flag | State | Dependency |
|---|---:|---|
| `VITE_FEATURE_BUSINESS_PROFILES` | `true` | Supabase profiles, trusted logo storage |
| `VITE_FEATURE_MESSAGING` | `true` | Conversations/inquiries RPC and RLS |
| `VITE_FEATURE_ESSENTIAL_NOTIFICATIONS` | `true` | Five-event notification RPCs and expiry worker |

These flags passed contract, SQL and hosted API/Storage/worker acceptance. The
staging deployment workflow enables them. They must all be `true` in a V1
production build.

## Dormant Tours boundary

`VITE_FEATURE_TOURS=false` keeps all buyer and seller Tour UI hidden.
`TOURS_BACKEND_ENABLED=false` independently closes upload, processing and
playback Edge Functions, while the database feature control defaults to false.
All three layers must be deliberately enabled in staging before any public
acceptance. A browser flag alone cannot activate Tours.

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
