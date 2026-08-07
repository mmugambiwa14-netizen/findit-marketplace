# PHASE 08 — TRUST, SAFETY & FRAUD

**Audited ref:** `origin/main` @ `ee6f212`

## 8.1 What a Peek actually proves — and what the UI claims

**What it is:** a seller-captured video, uploaded through `<input capture="environment">` or file picker,
validated and transcoded to 720p, then published automatically.

**What it therefore proves:** that *some* video was supplied by the listing owner's account, at an unproven
time, of an unproven location.

**What it does not prove:** ownership, legal title, roadworthiness, identity, financial safety, or even that
the footage is current or of the advertised asset.

**UI claims assessed:**

| Copy | Location | Verdict |
|---|---|---|
| "PeekaListing helps buyers evaluate offers… does not collect payments, hold funds, provide escrow, or guarantee a transaction" | `FAQs.jsx:29` | **Accurate** |
| "Always view the property in person before making a payment. Never send money to someone you have not met." | `PropertyDetail.jsx:106` | **Accurate and well placed** |
| "Agree on the scope, timeline and pricing in writing before work begins." | `ServiceDetail.jsx:90` | **Accurate** |
| Manifest description: "request current evidence before you commit" | `manifest.webmanifest` | **Slightly strong** — "current" is not verified; capture time is not attested |
| Terms: "FindIt does not verify the accuracy of listings, the condition or ownership of items, or the identity of every user" | `legalContent.js:223` | **Accurate** — and correctly disclaims |

**Verdict: the product does not overclaim.** No surface asserts a Peek proves ownership, title or
roadworthiness. → one wording issue only, **F-037 (P3)**: "current evidence" implies recency that nothing
in the pipeline attests. Capture timestamp is not verified and no freshness indicator was found.

## 8.2 What business verification attests to

`business_applications` → admin decision → `business_profiles.verified` / `verification_status`.
Evidence stays owner/admin-only; the public projection exposes approved state only (Phase 3, FLOW-13).
Terms correctly scope the claim (`legalContent.js:223`: *"Verified status, where shown, means…"*).
Owners cannot self-verify. **Separation from content moderation is maintained.** PASS.

## 8.3 Fraud vectors

| Vector | Control present | Residual |
|---|---|---|
| Stolen / recycled property media | Media ownership proven at upload; **no perceptual hashing or reverse-image check** | **HIGH** — nothing prevents uploading photos taken from another listing or website |
| Viewing-fee / deposit scam | Safety panels on detail pages; Terms warn | **MEDIUM** — advisory only |
| Cloned business | Verification is admin-reviewed | **MEDIUM** — depends on reviewer diligence |
| Misleading duty/import claims | **Not modelled at all** — no duty/import field (F-021) | **HIGH** for vehicles; the claim lives in free-text description where it cannot be filtered, validated or challenged |
| Fake machinery specs | `usage_hours` constrained non-negative; year plausible | **MEDIUM** — no capacity or certification fields (F-021) |
| Bait pricing | Price bounded `> 0`; no outlier detection | **MEDIUM** |
| Off-platform payment pressure | Messaging rate-limited; reporting exists | **MEDIUM** — no content scanning (AI moderation flags are all `false`) |
| Duplicate asset listings | `submission_key` blocks identical replay only | **MEDIUM** — a re-typed duplicate posts freely |
| Contact scraping | 40/24h per account + audit | **HIGH** — see F-035 |
| Impersonation | Account required; no identity verification for ordinary sellers | **MEDIUM** |

→ **F-038 (P2)** — no duplicate/stolen-media detection of any kind. For property and vehicles, recycled
photography is the highest-frequency real-world fraud pattern, and the product's central promise is visual
evidence. A Peek is a partial answer (it is harder to fake fresh video than to copy a photo), but Peeks are
not reachable in production (F-003), so at launch the only media on a listing is unverifiable stills.

## 8.4 Media location / EXIF privacy

Deliberate coarsening exists — `public_latitude` / `public_longitude` / `public_location_label` are public
while exact coordinates live in `listing_private_locations` (owner/service only). That control is defeated
if listing photos ship with camera EXIF GPS. No strip step is evidenced (**F-033**, Phase 6).

## 8.5 Buyer safety guidance

Present and specific: `SafetyPanel` on property and service detail, `MakeOfferButton.jsx:37`
(*"inspect the item in person before paying"*), FAQ warnings, Community Rules document.
Weakened only by carrying the wrong product name (**F-001**).

## 8.6 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-037 | P3 | CONFIRMED | "Current evidence" wording implies a recency the pipeline does not attest; no capture-time verification or freshness indicator |
| F-038 | P2 | CONFIRMED | No duplicate or stolen-media detection, against the highest-frequency fraud pattern in property and vehicle marketplaces |
