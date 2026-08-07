# FLOW-10 — Contact reveal (audited, rate-limited, external hand-off)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`ContactButtons.jsx` → `contactRevealRepository` → **`reveal_listing_contact(uuid)`** / `reveal_service_contact(uuid)` (`0109`, `0115`) → `contact_reveal_events` audit row → external hand-off at `ContactButtons.jsx:136-143`.

## Assessment — one of the best-executed boundaries in the product
| Control | Evidence |
|---|---|
| Not readable directly | contacts revoked from `anon` (`0109:49,52`) **and** `authenticated` (`0115:184,187`), on top of the table-level grant revoke (`0049:252`) |
| Affordance without value | generated `has_contact_phone/whatsapp/email` columns |
| **Audited** | every reveal writes `contact_reveal_events` |
| **Rate limited** | `v_limit constant integer := 40` per rolling **24 hours** (`0109:103,108`), raising `54000` |
| Owner exemption | `0115` fixes owners consuming their own reveal budget |
| Confirmation UX | `ContactButtons.jsx:198-209` warns before each external hand-off |
| Safe hand-off | `tel:` / `mailto:` / `wa.me`; WhatsApp digits stripped with `replace(/[^0-9]/g,'')` (`:142`) |
| Phone normalization | `phoneNumber.js` is country-code driven with `DEFAULT_COUNTRY_CODE = { code: "+263", country: "Zimbabwe" }` (`constants.js:459`) — generalised across markets rather than hardcoded |

**Appendix C — "Contact reveal is server-gated/audited/rate-limited" = PASS.**

## Gaps
- **F-001** — the reveal confirmation copy says "FindIt will open your phone app…" (`ContactButtons.jsx:198-209,250`), so the most trust-sensitive moment in the product shows the wrong brand.
- 40 reveals/24h is generous for a scraper operating a small pool of accounts; assessed further in Phase 6.
