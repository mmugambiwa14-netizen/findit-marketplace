# Release Control

Use these documents for production readiness:

1. `PRODUCTION_BLOCKER_REGISTER_2026-08-05.md` — authoritative blocker list and closure evidence.
2. `PROVIDER_SETUP_CHECKLIST.md` — owner-managed provider and account setup.
3. `RELEASE_EVIDENCE_TEMPLATE.md` — evidence pack for the exact final commit.
4. `LAUNCH_SCOPE_EXCLUSIONS.md` — capabilities that must remain disabled unless separately certified.

The repository is not production-approved merely because it builds or deploys to Vercel. Promotion requires all P0 gates, all launch-scope P1 gates, hosted acceptance, and a recorded go/no-go decision.
