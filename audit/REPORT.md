# PEEKALISTING (PaL) — PRE-PRODUCTION READINESS AUDIT

**Repository:** `mmugambiwa14-netizen/findit-marketplace`
**Audited ref:** `origin/main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`
**Audit date:** 2026-08-07 · Phases 0–17 executed sequentially
**Findings:** 56 — **0 P0**, 8 P1, 31 P2, 17 P3

---

## 1. Executive summary

### PRODUCTION READY: **NO — CONDITIONALLY, after Tranche 0**

**No P0 was found.** That is the headline, and it is earned rather than assumed: the audit specifically
hunted for the P0 patterns named in the brief — service-role in the browser, public seller contacts, auth
bypass, cross-owner listing edit, business self-verification — and each was traced to a working control.
Several were near-misses that the project had already found and closed itself.

The reason the verdict is still NO is that **the repository cannot currently demonstrate its own quality.**
Every release, certification, migration and deployment workflow has failed on `main` — not once, but on
every run in recent history, including the commit titled *"final-release-certification"*. A single early
gate failure causes lint, all four typechecks, the production build, the contract suites and internal
certification to be **skipped**, so 15 already-written failing tests and 10 typecheck errors sit on the
release branch unreported. The engineering underneath is considerably better than the release process
around it.

### Top 3 launch risks

1. **The quality pipeline is dark (F-012, F-013, F-054).** Five of five workflows red; the gate
   short-circuits and skips everything after it; staging is not being built. The repository's own tests
   already detect four defects this audit found independently — they were committed, then made invisible.
2. **Step-up authentication is decorative (F-027).** MFA is a React branch. No policy, function or trigger
   in 159 migrations checks the assurance level, so a stolen aal1 token reaches every admin RPC — ban,
   takedown, Peek removal, verification decisions — directly.
3. **The product cannot launch as itself (F-003, F-001, F-011, F-043).** Public Peeks — the differentiator —
   are gated off in every production path; the customer-facing product is still called FindIt in ~60 files
   including the entire legal corpus; the Terms name no operator; and every listing shared to WhatsApp
   produces a blank preview.

### Evidence tiers — reported separately, never blurred

| Tier | Coverage |
|---|---|
| **Repository-certified** (static) | Full — 159 migrations, 326 `src` files, 18 workflows, 141 tests, all read on `main` |
| **Locally executed** | Full — `npm ci`, `vite build`, ESLint, `tsc`, `typecheck:active`, 4 build verifiers, 797 tests |
| **Hosted-certified (GitHub Actions)** | Verified live via API — workflow runs, conclusions, job step outcomes |
| **Externally unverified** | **Supabase, Vercel, Cloudflare, R2, Turnstile, DNS/TLS, PITR** — MCP access was blocked (E-000). Every dependent gate below is marked EXTERNAL EVIDENCE REQUIRED, never PASS. |

### What is genuinely strong

This is not a weak codebase, and the report would be misleading if it read as one:

- **97/99 public tables have RLS; 165/165 `SECURITY DEFINER` functions pin `search_path`; 0 mutating functions reachable by `anon`.**
- Every core mutation goes through an RPC with an ownership predicate, row lock, explicit SQLSTATE and idempotency key. **No IDOR found across 14 object types and 20 journeys.**
- Media ownership is proven against `storage.objects` owner, mimetype and byte size under a lock — defeating attach-someone-else's-upload and swap-after-intent.
- The seller contact boundary is closed in two deliberate steps, in the correct order (table grant revoked *before* column revokes, or the latter would have been no-ops), with the staging reproduction documented in the migration itself.
- Exact property coordinates are isolated in a separate owner-only table.
- CSP with no `script-src 'unsafe-inline'`; no `dangerouslySetInnerHTML`; `safeUrl.js` enforces a scheme allowlist at render time *because* PostgREST bypasses client validation.
- Zero `@ts-ignore`, zero `eslint-disable`, one false-positive TODO across 32k LOC.
- Accessibility well above typical: skip link, 206 aria-labels, 68 h1s, styled focus rings, live regions.
- The non-monetisation boundary is clean — no payment integration exists to audit as a dangerous partial.

---

## 2. Severity heat map

| Area | P0 | P1 | P2 | P3 | Assessment |
|---|---:|---:|---:|---:|---|
| Repository & hygiene | 0 | 0 | 0 | 3 | **Excellent** |
| Build & config | 0 | 0 | 1 | 3 | Strong |
| Schema & data model | 0 | 0 | 3 | 2 | Sound; attribute coverage thin |
| **RLS & RPC security** | **0** | **0** | **1** | **2** | **Strongest layer in the codebase** |
| Auth & authorization | 0 | 1 | 0 | 0 | Strong except step-up |
| Listings & lifecycle | 0 | 0 | 1 | 0 | Strong; `sold` missing |
| Search | 0 | 0 | 0 | 1 | Sound |
| Peeks & requests | 0 | 1 | 2 | 0 | Logic strong, delivery blocked |
| Messaging | 0 | 0 | 1 | 0 | Latency risk |
| Verified business | 0 | 0 | 0 | 0 | Sound |
| Safety & trust | 0 | 0 | 3 | 1 | Advisory controls only |
| Frontend & a11y | 0 | 0 | 1 | 1 | Above typical |
| Performance | 0 | 0 | 3 | 0 | Heavy for 3G |
| **SEO & sharing** | 0 | **1** | 1 | 1 | **Weakest product area** |
| Observability | 0 | 1 | 1 | 0 | Blind in the browser |
| Privacy & legal | 0 | 1 | 1 | 0 | Incomplete documents |
| **Testing** | 0 | 0 | 3 | 0 | **False confidence** |
| **CI/CD & release** | 0 | **3** | 0 | 0 | **Broken** |
| Infrastructure | 0 | 0 | 3 | 0 | Largely unprovisioned |

---

## 3. Systemic root causes

Six causes explain 51 of the 56 findings.

**RC-1 — A gate that fails closed on itself, then opens everything behind it.**
`verify:sql-boundary` rejects a `drop table` in the Peek fulfilment rollback. Because the gate steps are
sequential with no `if: always()`, twelve later steps *skip*. The pipeline reports one failure and silently
stops verifying anything else.
→ F-012, F-013, F-014, F-049, F-050, F-054, F-017, F-042, F-029

**RC-2 — Controls implemented at one layer but not the layer that enforces them.**
MFA in React but not in SQL. Location coarsened in the database but EXIF unstripped in media. Turnstile
written server-side but never called from the client. Attribute validation in a browser registry the server
never reads.
→ F-027, F-033, F-034, F-019, F-020, F-022

**RC-3 — Scaffolding shipped ahead of implementation, then left indistinguishable from working code.**
A 1,100-LOC schema registry wired to nothing. A Cloudflare Worker whose Queue, KV, Durable Object and media
host bindings are declared and never used. 14 out-of-MVP tables. Five orphaned components.
→ F-019, F-020, F-023, F-055, F-010, F-052, F-018, F-009

**RC-4 — A rebrand applied to the shell but not the substance, and then locked in by a test.**
Manifest, service worker and bootstrap say PeekaListing; 111 occurrences across ~60 files — including the
whole legal corpus — still say FindIt. The brand contract test checks 3 files and passes.
→ F-001, F-002, F-011, F-049, F-052, F-007

**RC-5 — The product was built as an application, not as a set of shareable, observable pages.**
No per-route metadata, no OG tags, no prerender, no sitemap, no frontend error reporting, no analytics.
Everything the outside world and the operator would use to see the product is absent.
→ F-043, F-044, F-045, F-046, F-047

**RC-6 — Capability gating tied to an environment that does not exist.**
Peeks, messaging, notifications and current-location only switch on in "trusted staging", identified partly
by a client-readable hostname prefix and a list of stale branches — and staging deployment is failing.
→ F-003, F-004, F-006, F-054, F-053

---

## 4. Remediation plan

**No code has been changed. This is a proposal awaiting approval.**

### Tranche 0 — launch blockers (9 findings)

Ordered by dependency, not severity.

| # | Finding | Action | Effort |
|---|---|---|---|
| 1 | **F-013** | Add `if: always()` to independent verification steps so one failure cannot mask the rest; resolve the rollback-versus-policy conflict for `20260807020000_...rollback.sql:11` | S |
| 2 | **F-012** | With gates actually running, drive `main` green; then make the workflows required checks | M |
| 3 | **F-054** | Restore staging deployment — prerequisite for any Peek release acceptance | M |
| 4 | **F-027** | Enforce `auth.jwt() ->> 'aal' = 'aal2'` in `private.is_admin()` / `is_super_admin()` for factor-enrolled accounts | M |
| 5 | **F-033** | Strip EXIF/GPS on image upload; without it the deliberate coordinate coarsening is bypassed | M |
| 6 | **F-011** | Complete operator legal name, registered address, retention periods and the liability decision — **REQUIRES PROFESSIONAL REVIEW** | M |
| 7 | **F-001** | Sweep all user-visible strings to PeekaListing (keep `--findit-*` tokens and `__findit_*` storage keys) | M |
| 8 | **F-002** | Broaden the brand contract to the whole `src/` tree so it fails on current `main` | S |
| 9 | **F-003** | Complete and evidence Peek release acceptance, **or** record an explicit decision to launch without Public Peeks | L |

*Note: F-001 and F-011 are P2/P1 but sit in Tranche 0 because shipping a marketplace under the wrong name
with an unidentified legal operator is a launch decision, not a polish item.*

### Tranche 1 — strongly recommended pre-launch (17)

F-043 (metadata/OG — the WhatsApp preview), F-046 (frontend error reporting), F-051 (one E2E journey),
F-049 (obsolete contradictory tests), F-029 (`sold` transition), F-030 (seller queue route),
F-031 (message latency), F-026 (`moderation_status` default), F-034 + F-035 (Turnstile + scraping),
F-036 (cross-currency ordering), F-042 (image derivatives), F-057 (restore drill), F-004, F-005, F-014, F-023.

### Tranche 2 — first 30 days (25)

F-019/F-020/F-021 (attribute strategy), F-038 (stolen-media detection), F-040/F-041 (payload),
F-044 (sitemap), F-047 (analytics), F-048 (data export), F-050 (behavioural tests), F-053 (runtime flags),
F-055 (Cloudflare decision), F-056 (rollback coverage), plus the remaining P3s.

### Tranche 3 — architectural (5)

F-007 (script vocabulary), F-024 (parts taxonomy), F-045 (slugs and status codes), F-037 (Peek recency
attestation), F-052 (queue vocabulary).

### Dependency sequence

```
F-013 ──► F-012 ──► F-054 ──► F-003            (gates → green → staging → Peek acceptance)
F-027, F-033 ────────────────► independent, start immediately
F-011 (counsel) ──► F-001 ──► F-002            (legal text settles the copy the sweep applies)
F-012 ──► F-049 ──► F-050 ──► F-051            (green suite before adding coverage)
F-034 ──► F-035                                (CAPTCHA before per-source caps are meaningful)
E-003 ──► launch                               (preview-writes-production must be disproven)
```

Schema → authorization → server validation → repository → UI → tests → hosted certification.

---

## 5. Appendix C — production readiness gate

**Legend:** PASS · FAIL · N/A · **EXT** = EXTERNAL EVIDENCE REQUIRED

### Repository / security
| Item | Verdict | Evidence |
|---|---|---|
| `main` is sole release truth | PASS | Audit reset onto `origin/main`; 16 branches fully merged |
| Branch-only work has a reconcile/defer decision | **FAIL** | 13 branches unreconciled, incl. `develop` +434 (Phase 0 §0.3) |
| No secrets in repo/history/browser | PASS | No `.env` ever committed; 0 `SERVICE_ROLE` in `src/` |
| Service-role server-only | PASS | 0 in `src/`; `verify-bundle-secrets.mjs` passes on real `dist/` |
| Base44 runtime eliminated | PASS | 13 comment-only refs; build gate enforces |
| Active branding is PeekaListing | **FAIL** | F-001 — 111 occurrences across ~60 files |
| RLS tested on private/user/business data | **EXT** | 53 pgTAP suites exist; no successful hosted run (F-012) |
| Privileged actions server-authorized | PASS | `is_admin()` RPC; fails closed |
| IDOR sweep clean | PASS | 14 object types, 20 flows — none found |
| Security-definer safe `search_path`/grants | PASS | 165/165 pinned |
| Public projections exclude private contacts/evidence | PASS | Phase 3 §3.4 grant-order trace |
| Contact reveal server-gated/audited/rate-limited | PASS | `0109`/`0115`; 40/24h; `contact_reveal_events` |

### Auth
| Item | Verdict | Evidence |
|---|---|---|
| Signup/signin/recovery/logout work | **EXT** | Code correct; hosted auth settings unverified (E-004) |
| **MFA cannot be route-bypassed** | **FAIL** | F-027 — zero `aal` checks in 159 migrations |
| Business owners cannot self-verify | PASS | Admin-only decision path |
| Admin roles cannot self-assign | PASS | `protect_user_managed_fields()` `0011:52`; delegation disabled |
| Suspension/ban enforcement works | PASS | Trigger-protected; `is_active_user()` on writes |

### Listings
| Item | Verdict | Evidence |
|---|---|---|
| Draft/resume works | PASS | `usePersistentFormDraft`; `CreateListing.jsx:57` |
| Submission validates server-side | PASS | `create_v1_listing_submission` |
| Media ownership enforced | PASS | Intent + `storage.objects` owner/mime/size under lock |
| Category data stored atomically | PASS | Single transaction |
| **Valid listings publish without human review** | **PASS** | `auto_publish_validated_mvp_listing()` + backfill |
| Search/cards/detail see publication | PASS | `status='available'` on insert |
| Edit does not force routine moderation | PASS | No action routes to `pending_review` |
| Pause/resume works | PASS | `owner_transition_listing` |
| Relist works without moderation | PASS | `submit` from `expired`/`unavailable`/`rejected` |
| Unavailable/delete removes public visibility | PASS | RLS `listings_public_read_available` |
| Contacts private until reveal | PASS | Revoked from `anon` and `authenticated` |

### Search
| Item | Verdict | Evidence |
|---|---|---|
| Bounded public projections | PASS | 35-column allowlist |
| Stable bounded pagination | **PARTIAL** | Cursor RPC primary; one offset path remains (F-028) |
| Authoritative public-status filter | PASS | Enforced in RLS |
| Taxonomy/filter consistency | PASS | 121 leaves; server-validated |
| No hidden/private result leakage | PASS | Phase 3 |
| Scale meets release budget | **EXT** | Scale scripts exist; never executed hosted |

### Peeks
| Item | Verdict | Evidence |
|---|---|---|
| Public discovery works | **FAIL** | F-003 — `/peek` absent in production |
| Media validated/privacy-safe | PASS | Private buckets, signed URLs, MIME + size caps |
| Successful processing auto-publishes | PASS | `0033:515` |
| No human approval required | PASS | Phase 16 §16.2 determination |
| Failed media not exposed | PASS | Requires `status='ready'` |

### Peek Request / fulfilment
| Item | Verdict | Evidence |
|---|---|---|
| Buyer request works | PASS | `20260804191200` |
| Correct seller receives | PASS | `peek_request_parent_owner` |
| Accept/decline | PASS | `accept_peek_request` |
| Only correct seller fulfils | PASS | Ownership predicate |
| Capture/upload uses authoritative binding | PASS | Intent-based |
| Processing state survives reload | PASS | Server-side fulfilment state |
| Response Peek binds | PASS | Binding intents + triggers |
| Buyer notified | PASS | `app_alerts` idempotent |
| Buyer views result | **EXT** | Depends on E-002 worker |
| Cancel/failure/retry/expiry work | PASS | 48h expiry; stale expiry function |
| Abandoned attempts cannot answer later | PASS | Status triggers |
| Retries bounded | PASS | Explicit cap |

### Messaging / notifications
| Item | Verdict | Evidence |
|---|---|---|
| Participant authorization | PASS | `conversations_participant_read` |
| Message validation | PASS | RPC + `sanitizeText` |
| Bounded pagination | PASS | `p_limit`; thread cap 200 |
| Block/report | PASS | `conversation_reports` |
| Realtime/polling understood | **FAIL** | F-031 — neither realtime nor refetch |
| Current Peek events projected | PASS | `app_alerts` |
| Deep links valid | **FAIL** | F-030 — seller alert → buyer page |
| Provider failures degrade safely | **EXT** | E-004 |

### Verified business
| Item | Verdict | Evidence |
|---|---|---|
| Application works | PASS | `business_applications` |
| Evidence private | PASS | Owner/admin only |
| Approve/reject works | PASS | Admin RPCs |
| Required decision reasons | **EXT** | Not traced to UI |
| Profile state sync | PASS | `20260807010000` |
| Public badge exposes safe approved state only | PASS | `private.public_business_profiles` |
| Pending/rejected/reviewer data private | PASS | `0013:274` dropped public read |
| Suspension works | PASS | Status-driven |
| Notifications | **EXT** | Not traced |
| Audit | PASS | `business_review_events` |

### Safety
| Item | Verdict | Evidence |
|---|---|---|
| Report submission/queue | PASS | `reports` + `/admin/reports` |
| Listing/service takedown | PASS | Admin RPCs |
| Peek report-driven removal/restoration | PASS | `0034:146,367-368` |
| **No routine approval dependency** | **PASS** | Phase 16 §16.2 |
| Conversation action | PASS | `conversation_reports` |
| Destructive actions require reason/confirmation | PASS | Confirmation dialogs; reason fields |
| Audit records protected | PASS | `audit_logs` admin-only |

### Media / infrastructure
| Item | Verdict | Evidence |
|---|---|---|
| Image server-side validation | PASS | MIME + byte-size verified against `storage.objects` |
| Peek type/size/duration validation | PASS | Bucket constraints |
| **EXIF/GPS posture safe** | **FAIL** | F-033 |
| Heavy processing not on short Edge execution | PASS | Dedicated worker (`workers/media`) |
| Queue/worker retries bounded | PASS | Retry cap; dead-letter table |
| R2/Cloudflare externally verified | **EXT** | E-001; F-055 shows bindings unused |
| Orphan cleanup | PASS | `tour_asset_cleanup_queue`, `media-lifecycle-cleanup` |
| Deleted/private media not indefinitely public | PASS | Private buckets + signed URLs |

### Frontend / PWA
| Item | Verdict | Evidence |
|---|---|---|
| Core mobile flows 320–414 | **EXT** | Requires rendering |
| Touch targets acceptable | PASS (sampled) | 180 sizing utilities; `h-11` on primaries |
| Critical async states complete | PASS | `state-matrix.csv` |
| Keyboard critical flows | **EXT** | Requires rendering |
| WCAG 2.2 AA top templates | **PARTIAL** | 9 PASS, 1 FAIL (F-039), 4 UNVERIFIED |
| Manifest PeekaListing | PASS | Name/short_name correct |
| Legacy FindIt caches upgrade safely | PASS | `deleteFindItCaches()` |
| Weak-network/offline no white-screen | PASS | No white-screen path found |

### Performance
| Item | Verdict | Evidence |
|---|---|---|
| Card derivatives not originals | **FAIL** | F-042 |
| Initial JS budget | **PARTIAL** | Budget gate green; ~178 KB gzip heavy for 3G (F-040) |
| Detail acceptable on 3G | **EXT** | No field measurement |
| Search requests bounded | PASS | Cursor + `p_limit` |
| Peek media not eagerly downloaded | PASS | `Tours.jsx:245` |
| Upload retries don't amplify | PASS | `retry: 1`; server retry cap |

### SEO
| Item | Verdict | Evidence |
|---|---|---|
| Vite route crawlability understood | PASS | Documented in `robots.txt` |
| Listing metadata proven | **FAIL** | F-043 — none exists |
| Canonical URLs correct | **FAIL** | No canonical tags |
| Sitemap/robots correct | **PARTIAL** | robots good; no sitemap (F-044) |
| WhatsApp preview acceptable | **FAIL** | F-043 |
| `peekalisting.com` canonical | **EXT** | E-006 |

### Observability
| Item | Verdict | Evidence |
|---|---|---|
| Frontend errors captured | **FAIL** | F-046 |
| Server/Edge/Worker failures captured | PASS | Health fns, dead letters, circuit state |
| Media failures observable | PASS | `listing_tour_events` |
| Correlation/trace | PASS | `traceContext.js` `x-request-id` |
| No sensitive PII logs | PASS | 7 `console.*`; Error objects only |
| Seller funnel measurable | **FAIL** | F-047 |
| Buyer funnel measurable | **FAIL** | F-047 |

### Privacy / legal
| Item | Verdict | Evidence |
|---|---|---|
| Terms match MVP | **PARTIAL** | Substance accurate; placeholders unfilled (F-011) |
| Privacy matches processors/data | **PARTIAL** | Processor list incomplete (`:197`) |
| Safety guidance matches risks | PASS | Safety panels, FAQ warnings |
| Account deletion documented/tested | PASS | Edge Function + receipts |
| Data export documented/tested | **FAIL** | F-048 |
| Exact property location safe | **PARTIAL** | DB-safe; defeated by F-033 |
| Counsel-required conclusions flagged | PASS | Phase 13 |

### CI/CD / DR
| Item | Verdict | Evidence |
|---|---|---|
| PR lint/typecheck/contracts/build execute | **FAIL** | F-013 — all skipped |
| Clean DB migration executes | **FAIL** | Migration gates 0/4 success |
| Separate staging | **FAIL** | F-054 — staging not building |
| **Preview never writes production** | **EXT** | **E-003 — P0 if false; must be resolved before launch** |
| Hosted buyer journey executed | **EXT** | E-004 |
| Hosted verified-business journey | **EXT** | E-004 |
| Hosted Peek fulfilment | **EXT** | E-002/E-004 |
| Hosted listing publication | **EXT** | E-004 |
| Hosted safety operations | **EXT** | E-004 |
| Hosted media processing | **EXT** | E-002 |
| Hosted scale tests | **EXT** | E-004 |
| Deploy rollback exists | **EXT** | E-003 |
| Migration rollback strategy | **PARTIAL** | 100/159 covered (F-056) |
| PITR/backups externally verified | **EXT** | E-004 |
| Restore drill completed | **FAIL** | F-057 |
| DNS/TLS externally verified | **EXT** | E-006 |
| OAuth callbacks verified | **EXT** | E-006 |
| SPF/DKIM/DMARC verified | **EXT** | E-006 |
| Turnstile/rate limits verified | **FAIL** | F-034 — never invoked |

**Tally:** 61 PASS · 19 FAIL · 8 PARTIAL · 24 EXTERNAL EVIDENCE REQUIRED

---

## 6. Explicitly accepted / deferred risks

Recorded so they are decisions rather than oversights:

1. **Realtime deliberately removed** — vendor stub with measured bundle rationale. Accepted; but nothing replaced it (F-031).
2. **Vendor chunking rejected** — measured, documented at `vite.config.js:73-77`. Accepted.
3. **Aggressive caching** (30 min stale, no focus/reconnect refetch) — a genuine low-bandwidth optimisation. Accepted with the freshness cost noted.
4. **Out-of-MVP tables retained** — all deny-all. Accepted as schema debt (F-023, P3).
5. **Payments/reputation excluded** — confirmed clean; **no work recommended**.
6. **`moderation_status` / `pending_review` / Tour vocabulary retained** — harmless residue; renaming is Tranche 3.
7. **Analytics absent** — the brief permits an accepted gap; make it explicit (F-047).
8. **13 unreconciled branches** — need an explicit reconcile-or-abandon decision, not silent drift.

---

## 7. Audit limitations

Stated plainly so the report is not over-read:

- **No hosted infrastructure was verified.** MCP access to Supabase, Vercel and Cloudflare returned `requires approval` on every call (E-000). All 24 EXTERNAL rows above remain genuinely unknown, including the P0-class question of whether preview writes to production.
- **No browser was rendered.** Contrast, zoom, focus trapping, responsive behaviour at 320–414px and all Core Web Vitals are UNVERIFIED, not PASS.
- **No database was instantiated.** RLS conclusions come from replaying 159 migrations, not from querying a live instance; a hotfix applied directly to hosted would be invisible here.
- Local execution ran on **Node 22.22.2** against a declared engine of ≥23.6.0 (CI uses 24). Test and typecheck results were consistent and are not believed to be version-dependent, but this is noted.

---

## 8. Status

**Phases 0–17 complete. No application code, migration, dependency, test or configuration has been
modified. The only writes are the audit artifacts under `/audit/`.**

**Awaiting approval to execute Tranche 0.** On approval: proving test first, one finding and root cause per
commit, relevant certification run, finding status updated.
