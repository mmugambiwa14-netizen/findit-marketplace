# PHASE 14 — TESTING & QUALITY GATES

**Audited ref:** `origin/main` @ `ee6f212` · **Suites executed locally** ✅

## 14.1 HEADLINE — the tests already catch several of this audit's findings, and they are failing

Executed on canonical `main`:

```
$ node --test ./tests/*.test.mjs
# tests 756   # pass 742   # fail 14

$ node --test ./tests/security/*.test.mjs
# tests 41    # pass 40    # fail 1
```

**15 failing tests on the release branch.** CI never reports them because `verify:sql-boundary` fails at
step 10 and "Run all contracts" is **skipped** (F-013).

Four of the failures independently confirm **F-017** (PWA manifest), which this audit found separately:

```
not ok 748 - manifest declares the fields browsers require for installability
not ok 750 - every icon file referenced by the manifest exists
not ok 751 - a 192 and a 512 icon are present, which Chrome requires to install
not ok 752 - a maskable icon is declared and is a distinct file from the plain one
```

The repository *already knew*. The evidence was written, committed, and then made invisible by a gate that
short-circuits. This is the clearest possible argument for fixing F-013 first.

Other failures corroborate further findings:

| Failing test | Corroborates |
|---|---|
| `155 - owner journey supports edit pause resume relist unavailable and permanent delete` | **F-029** — lifecycle transitions incomplete |
| `22 - every JSX image declares loading and asynchronous decoding behavior` | **F-042** — image handling |
| `62 - browser storage failures degrade safely instead of crashing page flows` | resilience gap |
| `226 / 755 - workflow lockfile normalisation; approved immutable action commits` | supply-chain hygiene |

## 14.2 Obsolete tests encoding a superseded MVP model

| Failing test | Why it is obsolete |
|---|---|
| `508 - seller queue reuses the existing uploader and waits for moderation before answering` | Asserts a **human Peek moderation step that the MVP removed**. Exactly the stale-moderation assumption the brief warns about. |
| `34 - the polished FindIt identity is present across app shells and install metadata` | Asserts the **old brand**; fails *because* the rebrand happened. Directly contradicts `peekaListingBrandContracts.test.mjs`. |
| `684 / 686 - admin report queue exposes Tour identity …` | Legacy Tour vocabulary |
| `695 - staging deployment can expose preview or public Tours …` | Legacy Tours release model |

→ **F-049 (P2)** — the suite contains tests asserting the *opposite* of current product decisions. Two
tests now make contradictory brand assertions, so the suite cannot go green without deleting one.

## 14.3 False confidence — 83% of test files only read source strings

Of 141 Node test files, **117 (83%)** use `readFile`/`readFileSync` and assert with `assert.match` against
source text; only **24** import and exercise behaviour.

Source-string tests verify that code *looks* a certain way, not that it *works*. `peekaListingBrandContracts.test.mjs`
is the archetype already recorded as **F-002**: it reads 7 files and asserts FindIt-absence in 3, passing
green while 111 occurrences remain across ~60 files.

They are not worthless — they pin conventions cheaply — but a suite that is 83% string-matching cannot
substantiate a claim of release certification. → **F-050 (P2)**

## 14.4 Hosted tests skip silently

6 scripts depend on `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Without credentials they do not fail —
they no-op. So a green run of a hosted-labelled job may mean "nothing executed". Combined with the fact
that **no release/certification workflow has ever passed on `main`** (F-012), no hosted journey
certification has been evidenced at all. → **E-004**, and Appendix C hosted rows are marked
EXTERNAL EVIDENCE REQUIRED rather than PASS.

## 14.5 Coverage against the brief's launch priority list

| # | Priority | Coverage |
|---|---:|---|
| 1 | RLS / authz | pgTAP present (53 suites) + 7 security suites — **good**, but hosted execution unevidenced |
| 2 | IDOR | Partial — covered by RLS suites |
| 3 | Auth / MFA | `mfaEnrollmentContracts.test.mjs` exists — but **no test asserts server-side AAL enforcement**, which is why F-027 went unnoticed |
| 4 | Listing immediate publication | `listingPublicationJourneyContracts.test.mjs` |
| 5 | Category validation | Covered in submission contracts |
| 6 | Media ownership | Covered |
| 7 | Search projection/pagination | `publicSearchAndProjectionBoundary.test.mjs` |
| 8 | Contact reveal | `contactRevealBoundary.test.mjs` |
| 9 | Messaging | Contracts present |
| 10 | Verified business | `verifiedBusinessJourneyContracts.test.mjs` |
| 11–12 | Peek request / fulfilment | `peekFulfilmentJourneyContracts.test.mjs` |
| 13 | Reports / takedown | `safetyOperationsJourneyContracts.test.mjs` |
| 14 | Notifications | Partial |
| 15 | PWA | Present — **and failing** (§14.1) |
| 16 | Accessibility | Minimal; no axe/automated a11y run |
| 17 | Hosted media processing | **Unevidenced** — E-002 |

**No browser/E2E test framework exists** (no Playwright/Cypress in `package.json`), so the brief's
highest-value E2E — signup → create listing → publish → search → detail → Peek request → fulfilment →
buyer result — is not executed anywhere. → **F-051 (P2)**

One security failure, `31 - admin routes are nested beneath a required admin role boundary`, is assessed as
a **stale assertion rather than a real regression**: Phase 4 verified directly that all 10 admin routes are
nested under `ProtectedRoute requiredRole="admin"` (`App.jsx:199-211`) with server-side role resolution.

## 14.6 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-049 | P2 | CONFIRMED | Obsolete tests assert a removed Peek moderation step and the old brand, contradicting current product decisions and each other |
| F-050 | P2 | CONFIRMED | 83% of test files assert on source strings rather than behaviour |
| F-051 | P2 | CONFIRMED | No browser/E2E framework; the highest-value end-to-end journey is never executed |
