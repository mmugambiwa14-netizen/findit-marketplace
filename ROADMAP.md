# FindIt Roadmap

Reviewed: 2026-07-26

This roadmap begins after the approved V1 engineering migration. It does not
authorize launch or reactivate deferred code. Priorities assume a solo founder.

## Version 1.0 — Launch operations

| Work | Reason | Dependencies | Complexity | Priority |
|---|---|---|---|---|
| Select frontend host and production domain | Provide a stable public app and deep-link behavior | Host/plan and DNS decision | Medium | P0 |
| Resolve GitHub Actions startup restriction | Make gates and worker schedules operational | GitHub account/billing/policy support | External | P0 |
| Configure production SMTP | Deliver confirmation and recovery reliably | Mail provider, domain authentication and templates | Medium | P0 |
| Complete browser/device/accessibility acceptance | Prove real marketplace journeys and responsive UX | Deployed frontend URL | Medium | P0 |
| Provision production Supabase project | Isolate real users from staging | Plan, region, secrets and migration runbook | Medium | P0 |
| Configure monitoring and alerts | Detect Auth, database, Edge, worker and frontend failures | Telemetry choice and named responders | Medium | P0 |
| Prove native restore/PITR | Make launch recoverable | Provider capabilities, isolated restore target, RPO/RTO | High | P0 |
| Approve fresh launch or legacy-data reconciliation | Prevent silent data loss or false migration claims | Base44 export if legacy continuity is required | External/High | P0 |

## Version 1.1 — Marketplace quality

| Work | Reason | Dependencies | Complexity | Priority |
|---|---|---|---|---|
| Improve shared form validation | Make client and trusted-boundary feedback consistent | Approved schemas and error language | Medium | P1 |
| Add production search/load evidence | Validate latency and plans at representative scale | Realistic volume and monitoring | Medium | P1 |
| Add browser E2E regression suite | Preserve core journeys after launch | Stable deployed environment and test accounts | Medium | P1 |
| Add structured redacted telemetry | Improve incident diagnosis without leaking user data | Observability stack and privacy review | Medium | P1 |
| Refine accessibility and mobile polish | Address findings from launch acceptance | Device/screen-reader results | Medium | P1 |
| Add image derivatives/re-encoding if metrics justify it | Improve media performance and defense in depth | Storage budget and processing service | High | P2 |

## Version 1.2 — Trust and retention

| Work | Reason | Dependencies | Complexity | Priority |
|---|---|---|---|---|
| Saved searches | Improve return visits after core search is proven | Notification preferences and query model | Medium | P2 |
| Reviews and ratings redesign | Add trust without easy abuse | Transaction/interaction proof and moderation policy | High | P2 |
| Verification redesign | Add trust only with sustainable evidence review | Fraud model, privacy/retention policy and appeal operations | High | P2 |
| Richer support operations | Scale founder support after volume requires it | Relationship model, private attachments and staffing | High | P2 |

## Version 2.0 — Commercial capabilities

| Work | Reason | Dependencies | Complexity | Priority |
|---|---|---|---|---|
| Premium listings | Introduce a focused revenue path | Pricing validation, ranking rules and payment foundation | High | Future |
| Payments/subscriptions | Support paid marketplace services | Gateway, webhooks, reconciliation, refunds and finance operations | High | Future |
| Escrow | Enable higher-trust transactions only when operations can support disputes | Legal review, payments, KYC/AML and dispute operations | Very High | Future |
| Advanced dealer/business tools | Serve proven professional demand | Usage evidence, entitlements and billing | High | Future |

## Version 3.0 — Optional expansion

| Work | Reason | Dependencies | Complexity | Priority |
|---|---|---|---|---|
| Legal marketplace | Explore only as a separately approved product | Regulatory review, verification, booking and dispute model | Very High | Future |
| AI assistance/moderation | Add only where measured value exceeds safety and cost | Server gateway, evaluations, privacy, budgets and human review | High | Future |
| Intelligent recommendations | Improve discovery after sufficient behavioral data | Consent, analytics quality and ranking evaluation | High | Future |

If a future feature does not strengthen Discover, Advertise, Evaluate or
Contact, it should not enter planning.
