# Repository File Classification

Reviewed: 2026-07-26

The production repository has been reduced to the approved V1 graph,
Supabase implementation, verification automation, and handover documentation.

| Classification | Current treatment |
|---|---|
| Production | 165 modules reachable from `src/App.jsx`, plus `src/main.jsx`, build/configuration and static assets |
| Database/runtime | 30 migrations, SQL tests, two bucket definitions and four Edge Functions |
| Verification/operations | Contract and hosted smoke scripts, GitHub workflows, setup/deployment/backup utilities |
| Documentation | Product, architecture, migration, QA, security, recovery, roadmap and handover records |
| Legacy Base44 | Zero files in the working tree |
| Dormant unreachable code | Zero JS/JSX/TS/TSX modules outside the active graph at cleanup time |
| Experimental AI/entity artifacts | Removed |

The detailed pre-cleanup 607-file manifest and every removed file are preserved
in Git commit `55a5807`. The current enforcement mechanisms are:

- `npm run verify:base44-elimination`;
- `npm run typecheck` and `npm run typecheck:active`;
- `npm run test:contracts`;
- the production generated-output scan; and
- Git review of any new route, feature flag, dependency, migration or Edge
  Function.
