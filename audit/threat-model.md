# PEEKALISTING THREAT MODEL — TOP 10

**Audited ref:** `origin/main` @ `ee6f212`. Ranked by residual risk after existing controls.

| # | Threat | Attacker | Precondition | Path | Likelihood | Impact | Control present | Residual |
|---|---|---|---|---|---|---|---|---|
| 1 | **Admin takeover via stolen aal1 session** | Credential thief / phisher | One admin password or exfiltrated token | Sign in → receive aal1 session → ignore the SPA → call admin RPCs directly on `/rest/v1/rpc/` | Medium | **Critical** — ban users, take down listings, remove Peeks, decide verifications | Role checked server-side; MFA screen client-side only | **HIGH — F-027.** MFA provides no API-level protection |
| 2 | **Industrial contact harvesting** | Competitor / lead reseller | Free accounts | Register N accounts → 40 reveals each per 24 h → 25 accounts = 1,000 contacts/day | **High** | High — the marketplace's core asset is seller contact | Contacts revoked from `anon` and `authenticated`; reveal RPC audited + capped | **HIGH — F-035** (per-account cap) **+ F-034** (no CAPTCHA on signup) |
| 3 | **Recycled / stolen listing media** | Scammer | An account | Copy photos from another listing or the web → post a property or vehicle that does not exist or is not theirs | **High** | High — deposit and viewing-fee fraud | Upload ownership proven; report-driven takedown | **HIGH — F-038.** No perceptual hash, no reverse-image check |
| 4 | **Property location disclosure via photo EXIF** | Stalker / burglar | Any public listing | Download a listing image → read embedded GPS → exact address of an occupied home | Medium | **High** — physical safety | Coordinates deliberately coarsened in the DB | **HIGH — F-033.** No evidenced EXIF strip, so the coarsening is bypassed |
| 5 | **Misleading vehicle duty/import claims** | Seller | A vehicle listing | State false duty-paid status in free-text description | **High** | High — buyer inherits a large unexpected liability | None — field not modelled | **HIGH — F-021.** Unfilterable, unvalidatable, uncontestable |
| 6 | **Undetected regression reaching production** | None (process) | Merge to `main` | `verify:sql-boundary` fails → 12 later steps skip → lint/typecheck/build/contracts never run | **Certain — already occurring** | High | Gates exist and are correctly written | **HIGH — F-012/F-013.** 0 successful runs on `main` |
| 7 | **Launch without the core differentiator** | None (process) | Production deploy | `VITE_FEATURE_TOURS` unset → `/peek` route absent | **Certain** unless changed | High — product identity | Deliberate release gate | **HIGH — F-003.** Release acceptance unevidenced |
| 8 | **Users misled by an unidentified operator** | None (legal) | Visit `/legal/terms` | Terms name "[TO BE COMPLETED: operator legal name]" and the wrong product | **Certain** | High — enforceability, CDPA exposure | Documents exist and are thorough | **HIGH — F-011 + F-001** |
| 9 | **Off-platform diversion via message latency** | Opportunistic seller/buyer | Any conversation | Reply not seen (no realtime, no refetch on focus) → parties move to WhatsApp → contact privacy boundary defeated and platform loses the interaction | **High** | Medium | Rate-limited RPC messaging | **MEDIUM — F-031** |
| 10 | **Stranded Peek Requests** | None (latent defect) | Any insert path omitting `moderation_status` | Row defaults to `'pending'` → invisible to the public policy and rejected by `accept_peek_request` → buyer sees nothing, no error | Low | Medium | Current RPC sets `'approved'` explicitly | **MEDIUM — F-026** |

## Attacks the architecture already defeats

Recorded because they are the ones that usually succeed on marketplaces of this shape:

- **Cross-owner listing edit** — `owner_transition_listing` scopes to `seller_id = auth.uid()` with `FOR UPDATE`; `protect_listing_managed_fields()` blocks `status`, `verified`, `views`, `seller_id`.
- **Privilege escalation by self-assigning a role** — `protect_user_managed_fields()` trigger blocks `role` and `super_admin` against direct PostgREST writes; delegation disabled entirely.
- **Attaching another user's uploaded media** — intent must match `auth.uid()` *and* `storage.objects.owner_id`, mimetype and byte size, under a row lock.
- **Answering another seller's Peek Request** — `peek_request_parent_owner(...) = auth.uid()`.
- **Binding an abandoned attempt later** — stale-fulfilment expiry plus status triggers.
- **Retry amplification** — explicit retry cap and 48-hour expiry.
- **Anonymous contact scraping** — contact columns revoked from `anon` *and* `authenticated`, after the table-level grant was revoked first.
- **`javascript:` URLs from business profiles** — `safeUrl.js` enforces the scheme allowlist at render time, explicitly because PostgREST writes bypass client validation.
- **Negative, zero, extreme or wrong-currency prices** — bounded and country-scoped at the RPC.
- **XSS via listing content** — no `dangerouslySetInnerHTML`; CSP `script-src 'self'` with no `unsafe-inline`.
