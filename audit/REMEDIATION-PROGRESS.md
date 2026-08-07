# REMEDIATION PROGRESS — START HERE

> This file is the branch handoff. Every branch commit that changes code must update this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Audit baseline:** `origin/main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Execution spec:** `audit/REMEDIATION-PROMPT.md` — 35 work packages, 60 tracked findings.

```bash
git fetch origin
git checkout claude/peekalisting-audit-ui0z6l
git pull
git log --oneline origin/main..HEAD
```

---

## 1. Non-negotiable rules

1. Read `audit/REMEDIATION-PROMPT.md` §3.3 before editing.
2. Never weaken an existing control merely to make a test green.
3. Never reintroduce listing moderation, Peek moderation, payments or reputation.
4. Do not touch protected contact, role, media-ownership, URL, route, listing-transition, preview-auth, recovery or global-logout controls except through their approved package.
5. `DONE` requires an executed proving test. Use `PARTIAL`, `STATIC-ONLY` or `UNPROVEN` literally.
6. Every code commit updates this ledger in the same commit.

---

## 2. Current status

### Tranche 0

| WP | Findings | Status | Commit | Evidence |
|---|---|---|---|---|
| WP-01 | F-013 | **DONE** | `cb0b6c6` | Local 12/12 and CI run 31144698189 proved no verification-step cascade. |
| WP-02 | F-012/F-058/F-060/F-061 | **DONE** | `7e5b084` | CI run 31146750894 proved the three contracts; seven remaining reds are assigned to WP-15/WP-18/WP-19. |
| WP-03 | F-054 | **BLOCKED** | — | Vercel `build-rate-limit`; requires external plan/quota availability. |
| WP-04 | F-027 | **PARTIAL** | pending current commit | Server assurance migration, rollback, pgTAP and source contract written; clean-database execution pending. |
| WP-05 | F-033 | NOT-STARTED | — | Requires EXIF/GPS stripping proof. |
| WP-06 | F-011 | NOT-STARTED | — | Blocked on counsel/operator legal facts. |
| WP-07 | F-001/F-002 | NOT-STARTED | — | Full active-source brand contract required. |
| WP-08 | F-003 | NOT-STARTED | — | Public Peek route/capability decision required. |

Completed outside the current sequence: WP-09/F-049 `051cf8a`; WP-10/F-014 `8dc68fd`; F-059 `f50fc4a`.

### Totals before WP-04 proof

- **8 DONE**
- **1 PARTIAL:** F-027
- **1 BLOCKED:** F-054
- **50 NOT-STARTED**

---

## 3. WP-04 implementation boundary

The new migration changes the existing central authorization helpers rather than adding per-RPC browser-like checks:

- administrators with no verified factor remain permitted at aal1 so enrolment/recovery is not locked out;
- once `auth.mfa_factors` contains a verified factor, `auth.jwt() ->> 'aal'` must equal `aal2`;
- `private.is_admin()` and `private.is_super_admin()` both inherit the rule;
- every current RLS policy and administrator RPC that already calls those helpers inherits the server boundary;
- the public wrappers and their existing ACLs remain intact;
- the new private helpers have no browser-role EXECUTE grants.

This work is **UNPROVEN** until the clean-database migration job executes. Source-shape contracts are supplementary only.

---

## 4. Exact next action

1. Push the current WP-04 commit to draft PR #33.
2. Inspect `Migration gates` database job after the clean reset.
3. Required proof:
   - new migration applies;
   - `db lint --local --level error` passes;
   - `v1_admin_mfa_assurance_boundary.sql` passes all 12 assertions;
   - existing authorization-helper and curated-business suites remain green;
   - source contract `adminMfaAssuranceContracts.test.mjs` passes.
4. Repair only real SQL/schema incompatibilities; do not weaken aal1 denial or remove factor-conditional enrolment behavior.
5. Mark F-027 `DONE` only after executable database evidence.
6. Then proceed to WP-05/F-033. If hosted geotagged-object evidence is unavailable, separate repository implementation from external proof explicitly.

---

## 5. External blocked register

| Item | Required evidence |
|---|---|
| B-3 / E-003 | Vercel Preview and Production Supabase separation. |
| B-8 | Counsel/operator legal facts. |
| B-7 | Branch protection and Pages configuration. |
| F-054 / WP-03 | Vercel quota followed by a green staging deploy. |
| B-1/B-2/B-4/B-5/B-6 | Cloudflare, Supabase and DNS console evidence. |

---

## 6. Environment caveats

- Local shell cannot resolve GitHub; connected GitHub API is used for repository operations.
- No local database is available; GitHub Actions clean-database job is the executable proof boundary.
- No Supabase, Vercel, Cloudflare or DNS console access is available.

---

## 7. Handoff invariant

If code and this ledger disagree, inspect `git log origin/main..HEAD`, correct the ledger, and do not proceed until the handoff is coherent.
