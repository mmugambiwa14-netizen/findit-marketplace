# FindIt Product Progress

## Canonical source

- Authoritative branch: `main`
- Preview deployment source: `main`
- A feature is not complete until its code, migrations, flags, tests, and staging verification are all recorded here.
- Long-running branches are not product sources of truth.

## Status definitions

- Planned: approved but not started
- In progress: active branch or pull request
- Code complete: implementation finished but not merged
- Merged: present on `main`
- Database applied: required hosted migrations applied
- Staging verified: exercised successfully in the public staging environment
- Production ready: release gates and operational dependencies satisfied
- Superseded: replaced by newer work and must not be merged

## Capability ledger

| Capability | Code status | Database status | Preview/staging status | Canonical evidence | Notes |
|---|---|---|---|---|---|
| Shared listing detail redesign | Merged | Existing migrations | Staging verification required after consolidation | `main` | Shared listing layout, Peek actions, safety and seller sections |
| Search, filters and maps | Merged | Existing migrations | Environment-dependent | `main` | Requires MapTiler configuration for full map experience |
| Messaging reliability | Merged | Existing migrations | Staging verification required | `main` | Polling, focus and reconnect refresh are canonical; old realtime branch is superseded |
| Peek catalogue and Peek requests | Merged | Existing migrations | Staging verification required | `main` | Core differentiation remains in MVP |
| Curated/verified business marketplace | Merged during 2026-08-06 consolidation | Curated migrations pending hosted verification | Preview enabled; backend verification required | `main` | Includes application, review, publishing gates, managed listings and notifications |
| PWA and GitHub Pages preview | Merged | None | Active | `.github/workflows/pages-preview.yml` | Preview is temporary; production staging should move to Cloudflare |
| Tours legacy terminology | Superseded/transitioning | Existing migrations | Not a new product direction | `main` | Customer-facing terminology is Peek where already migrated |
| Realtime conversation branch | Superseded | Migration 0124 not canonical | Do not deploy | `feature/peek-threads-phase-3` | Incompatible with current no-realtime client boundary |

## Delivery rule

Every future feature must follow:

`requirement -> short-lived branch -> pull request -> tests -> merge to main -> migration application -> staging verification -> ledger update -> branch deletion`

No branch may be treated as complete merely because its code exists.
