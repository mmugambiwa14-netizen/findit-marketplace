# FindIt Migration Specification Document 2 Compliance Review

Date: 2026-07-17  
Specification: Version 3.0, Document 2 of 4  
Reviewed state: authoritative Phase 2B archive plus MD1 discovery corrections

> **Current-state addendum — 2026-07-25:** this review preserves the Phase 2B
> evidence and requirement analysis below. The pause described at that
> checkpoint was cleared for bounded, disabled-by-default vertical slices after
> local gates passed. The current clean chain reaches migration `0028`; all 49
> public tables have RLS, schema lint and 253 database assertions pass, and the
> active frontend has 29 service and 15 repository modules. Product-photo,
> service-photo and business/dealer-logo Storage/Edge paths also pass local SQL
> and real HTTP smokes. The lightweight Contact Support boundary also passes
> SQL/contracts and a real guest/admin API smoke. A recursive module-graph
> contract proves every module reachable from
> `src/App.jsx` is Base44-free, and the production build's generated-output
> verifier currently finds zero Base44 across 109 text assets. The 79 imports
> retained elsewhere are dormant/future migration inputs, not active V1
> session dependencies. Production-like upgrade/import reconciliation,
> browser acceptance, deployed operations and the
> future/deferred-domain authorization matrix remain open.
> React Router is now upgraded to 7.18.1, removing the two Moderate
> advisories. The applicability-aware production gate reports no reachable
> Moderate/High/Critical advisory and narrowly documents the RSC-action
> advisory as unreachable because this is a declarative SPA without RSC or
> server actions. Browser/deep-link regression remains blocked.

## 1. Outcome

Document 2 confirms the intended target stack and makes security, layering,
storage, validation, accessibility, and operational quality mandatory. The
Phase 2B tree is directionally aligned but not compliant or production-ready.

No broad Phase 2C/3 implementation is authorized by this review because the
existing SQL chain, RLS model, hybrid authentication, and production data/user
state remain unresolved stop conditions. This review adds the missing design
and security records needed to make the next implementation bounded and
testable.

## 2. Evidence collected

- React/Vite/router/query/configuration and all 80 pages.
- Service, hook, utility and direct client-call boundaries.
- All 12 SQL migrations, including 41 tables, 48 explicit indexes, 64 foreign
  key references, views, triggers and RLS policies.
- Auth/RBAC profile schema and privileged Base44 functions.
- All environment references in browser, build and exported function code.
- All 15 Base44 upload calls across 14 source modules.
- Validation-library use, raw HTML/CSS injection points, silent failures,
  audit logging, rate-limit evidence and attachment behavior.
- Production build output, lint/typecheck results and live npm advisory data.
- Static UI token, responsive utility, loading, form-label and icon-button
  indicators.

No production database query plans, asset manifest, traffic traces, browser
accessibility audit, mobile device run, provider configuration, or deployed
environment was available.

## 3. Requirement matrix

| Requirement | Current Phase 2B evidence | Status | Required action / phase |
|---|---|---|---|
| React + Vite frontend | React 18 and Vite 6 are present; build passes | In Progress | Preserve; remediate vulnerable tool versions and add clean quality gates |
| TypeScript where practical | Project is predominantly JS/JSX; `checkJs` fails and excludes `src/lib`, `src/services`, and `src/api` | Planned | Fix the typecheck boundary, then migrate new repositories/services and high-risk contracts incrementally |
| React Router | Router 7.18.1 and existing declarative routes are present; post-upgrade source/build gates pass | In Progress | Preserve routes; complete browser/deep-link and host-rewrite acceptance |
| Tailwind/UI stack | Tailwind/Radix tokens and reusable UI primitives exist | In Progress | Normalize tokens/variants incrementally; no redesign |
| TanStack Query | Used broadly for Base44 server state | In Progress | Keep in hooks; normalize keys/invalidation/pagination with service cutovers |
| React Hook Form/Zod | Dependencies exist, but only the shared form primitive imports RHF and no source imports Zod | Planned | Introduce shared schemas at service/API boundaries per migrated workflow, not as a wholesale form rewrite |
| Supabase backend | Auth client and Postgres migrations exist; clean local reset/lint pass | In Progress / shared deployment blocked | Preserve clean gate; implement repositories and protected server operations |
| PostgreSQL integrity | UUIDs, 64 FK references, enums, constraints and 48 indexes exist; clean local chain passes | Partially Verified | Resolve field parity/ambiguous relationships and test plans against production-like data |
| Rollback scripts | No down/rollback SQL files or restore exercise | Missing | Define forward-fix plus backup/restore strategy before first shared apply; destructive down migrations require evidence |
| Layered architecture | Pages/components call Base44 directly in 123 files; only `authService` exists; no repository directory | Missing target | Introduce domain-by-domain presentation -> hook -> service -> repository layering in Phase 3 |
| No direct Supabase from pages | Only `authService` currently calls Supabase | Satisfied for current partial cutover | Preserve rule as repositories are added; do not replace Base44 calls with page-level Supabase calls |
| Authentication parity | Local signup/confirmation/login/session/logout/recovery/profile-trigger smoke flow passes | In Progress / Blocked | Resolve hybrid Base44 identity and run browser/shared-provider expiry/revocation/error QA |
| Required RBAC roles | Database stores only `user`/`admin`; `super_admin` is a boolean; seller/dealer/business/lawyer are represented indirectly or not at all | Non-compliant / design blocked | Profile production behavior and define role vs capability/profile model before schema changes |
| Server-side authorization | Base44 functions enforce many admin checks; proposed RLS is incomplete; some admin pages call `asServiceRole` directly | In Progress / Critical gaps | Protected RPC/Edge Functions, least-privilege RLS, role matrix, no browser elevation |
| RLS on every exposed table | At this review checkpoint the clean catalog proved 41/41 and 22 focused pgTAP assertions passed; see the current-state addendum for the expanded schema | Partially Verified | Run the future/deferred-domain and production role/action/column matrix before exposure |
| Storage migration | Runtime still uses Base44 storage; no target buckets/policies | Planned / Blocked | Use `docs/STORAGE_MIGRATION_INVENTORY.md` and obtain production object manifest before Phase 4 |
| Asset/media preservation | 15 call sites identified; production URLs/objects unknown | Blocked | Export objects/ACLs/checksums, define URL mapping/redirect policy, reconcile |
| Environment documentation | `.env.example` covers browser and build variables and intentionally excludes server secrets | In Progress | `docs/ENVIRONMENT_VARIABLES.md` records the complete current/planned inventory, placement, and secrecy rules |
| Complete security review | Earlier risks covered SQL/auth; Document 2 review adds dependencies, bootstrap, upload, rate, XSS, audit and validation | In Progress | See `docs/SECURITY_REVIEW.md`; critical issues block shared deployment |
| Input validation | Local ad hoc checks; no Zod schemas; database constraints are incomplete workflow validation | Non-compliant | Shared schemas in services/server; database constraints remain final integrity layer |
| Output encoding/XSS | React escapes normal interpolation; the former chart `dangerouslySetInnerHTML` boundary now uses bounded IDs/keys, strict color tokens and ordinary React style text | Locally remediated | Keep the three injection-regression contracts mandatory; sanitize any separately approved rich content server-side and client-side |
| Rate limiting | No application rate-limit implementation found; provider/platform behavior unknown | Missing / Blocked | Implement documented endpoint/user/IP/storage quotas in Edge Functions/provider settings |
| Audit logging | Audit entity/table and nine Base44 privileged writers exist; writes are usually best-effort and schema lacks `result` | Partial / Non-compliant | Make privileged audit durable/required with actor/resource/action/before/after/result and protected retention |
| Error handling | UI often uses toasts, but at least ten explicit empty/silent catches were found | In Progress | Replace silence during each feature migration with typed/logged/recoverable errors |
| Dependency security | Seven unused direct packages were removed; React Router 7.18.1 removes both Moderate advisories. The production gate has no reachable Moderate/High/Critical finding and one explicit RSC-only applicability exception; the raw development audit remains nonzero | Partially Verified | Retain V1 route allowlists, complete browser regression, review the exact RSC exception, remediate development tooling, and audit every release |
| Performance | One 2,108,234-byte JS asset (575,659 gzip), 75 static page imports, no lazy/dynamic imports | Needs improvement | Establish route-level lazy loading after critical behavior tests; measure rather than redesign |
| Dead/unused code/deps | The archive's 155 unused-import errors were removed from 64 files and seven source-proven unused direct dependencies were removed; hidden/unrouted pages still need behavior evidence | Partially remediated | Import-only archive comparison, clean install, lint, audit, and build pass; do not delete hidden features without evidence |
| Design tokens | Theme colors/radii and UI primitives exist; 47 hex references across 25 values remain | Partial | Audit whether exceptions are brand/data visualization; standardize only verified inconsistencies |
| Interaction feedback | Loading/toast/empty patterns exist inconsistently; only two files reference Skeleton; no network-offline handling | Partial | Add consistent pending/success/error/empty/retry/offline states per workflow |
| Forms/accessibility | 104 `<label>` tags but only 25 `htmlFor` references; 23 icon-size button occurrences and only 12 aria-label occurrences overall | Needs audited remediation | Run automated/manual WCAG audit; fix associations/names/focus/touch targets without workflow changes |
| Responsive/mobile | 156 responsive utility references and mobile navigation exist | Partial / unverified | Test representative desktop/tablet/mobile viewports and touch/keyboard flows |
| Future compatibility | SPA and proposed Supabase stack can support wrappers/PWA/scaling, but service boundaries and operations are absent | Planned | Complete layers, APIs, queues, observability and deployment before claiming compatibility |

## 4. Target layer contract

The required architecture is accepted with these constraints:

```text
Page / component
  -> feature hook
    -> domain service
      -> repository or protected function client
        -> Supabase Auth / PostgREST / RPC / Storage / Edge Function
          -> PostgreSQL / provider
```

### Presentation

- Renders state and captures user intent.
- Does not build database filters, decide permissions, orchestrate multi-step
  business operations, or call Supabase directly.
- Existing workflow, route and information architecture remain unchanged.

### Hooks

- Own TanStack Query keys, caching, pending/error state, pagination and safe
  optimistic updates.
- Do not decide eligibility, authorization or domain transitions.

### Services

- Validate typed input, apply business rules and permissions, orchestrate
  repositories/server operations, normalize errors, and request side effects.
- Never render or return JSX/toasts.

### Repositories

- Own Supabase CRUD, queries, joins, pagination and RPC invocation.
- Return explicit domain/data results; no UI or business decisions.
- Multi-row atomic operations belong in PostgreSQL functions/Edge Functions,
  not a sequence of browser repository calls.

### Server/database

- Enforce authorization, input constraints, transactional integrity,
  idempotency, rate limits, audit and provider secret use.
- The browser never receives service-role or provider secrets.

No empty layer scaffolding is added now. The first repository/service must be
introduced with a real, verified feature contract and tests so the target does
not become ceremonial indirection.

## 5. RBAC interpretation requiring a decision

Document 2 names anonymous, authenticated, seller, dealer, business, lawyer,
admin and super_admin. Current FindIt behavior uses:

- Supabase/Postgres `anon` and `authenticated` database roles.
- Application `users.role` values `user` and `admin`.
- `users.super_admin` boolean.
- Seller/dealer/business/lawyer identity inferred from profiles, business type,
  practitioner records, verification type or UI context.

It is not safe to turn every profile type into one exclusive role without
production evidence: a person may be both a seller and business/practitioner,
and existing rules may be capability-based. Before an RBAC migration:

1. Inventory actual user/profile combinations and admin assignments.
2. Define whether seller/dealer/business/lawyer are roles, capabilities,
   memberships or verified profile types.
3. Define multi-role behavior and precedence.
4. Map every route/action/resource to permissions.
5. Implement server/database checks and test every role/action combination.

Until then, the current limited role model is documented as non-compliant but
is not destructively expanded from assumptions.

## 6. Database compliance notes

Strengths in source:

- UUID primary keys throughout.
- Email relationships are replaced with UUID foreign keys in the target.
- Native enums/checks, 64 references and 48 explicit indexes.
- Normalized listing category tables and explicit audit/content/support areas.

Blocking defects and unverified requirements:

- Migration `0004` and security-invoker view source are corrected; live
  clean/upgrade migration acceptance is still required.
- All 41 tables exposed at this review checkpoint enabled RLS and managed user
  fields/support inserts were hardened in source; see the addendum for the
  current 44-table catalog and expanded participant coverage.
- No clean apply, upgrade-path apply, rollback/restore, query plan, load or
  production-like cardinality test exists.
- Index presence does not prove query-plan quality; repository queries do not
  exist yet.
- Production email-to-UUID mapping, field parity and orphan handling are
  unknown.

Do not add speculative indexes or rollback SQL before query shapes and applied
migration state are known.

## 7. UI/UX preservation decision

Document 2 does not authorize a redesign. Existing routes, navigation, layout,
feature locations and workflows stay fixed. UI work should follow this order:

1. Capture staging screenshots and interaction states from the behavior
   baseline.
2. Fix accessibility, feedback and objectively inconsistent token usage.
3. Standardize shared components rather than restyling pages individually.
4. Test desktop/tablet/mobile, keyboard, screen reader and contrast.
5. Record any security-required behavior change.

Hidden/unrouted pages remain inventory items and are not dead-code deletion
candidates until production use is disproven.

## 8. Safe execution sequence

1. **Evidence gate:** specification document 4 has been reviewed; obtain
   Base44 production user/data/storage exports and deployed configuration.
2. **Dependency patch:** apply the compatible advisory update plan in isolation,
   remove only source-proven unused packages, build and smoke critical routes.
3. **Database correction:** choose edit-vs-forward-fix based on whether any
   migration has been applied; run empty/upgrade applies and the full RLS matrix.
4. **Auth/RBAC gate:** resolve hybrid identity, profile creation and role model;
   run browser/session/provider/blocked-account tests.
5. **Phase 3 pilot:** migrate one low-side-effect read domain through repository,
   service and hook with Base44 contract comparison and feature flag/rollback.
6. **Transactional/privileged domains:** implement protected RPC/Edge Functions,
   durable audit, idempotency and rate limiting.
7. **Storage:** migrate by asset class with private/public policies, checksum
   reconciliation and URL mapping.
8. **UI quality and performance:** address accessibility/feedback/tokens and
   measured code splitting without workflow redesign.

## 9. Current decision

The target architecture is accepted. The Phase 2B source is not relabeled as
failed merely because planned Base44 dependencies remain; those dependencies
retain their existing phase classifications. Broad implementation remains
paused at the SQL/auth/data stop conditions. Security and dependency fixes are
mandatory, but must be delivered as bounded, recoverable patches with the
verification needed to preserve production behavior.
