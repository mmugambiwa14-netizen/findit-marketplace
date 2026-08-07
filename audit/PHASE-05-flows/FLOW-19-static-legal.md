# FLOW-19 — Static, legal and help surfaces
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/help` → `FAQs.jsx`; `/help/contact` → `ContactSupport.jsx`; `/legal` and `/legal/:document` → `LegalPage.jsx` → `src/lib/legalContent.js` (404 LOC) filtered through `legalContentOverrides.legalParagraph` (`LegalPage.jsx:42`). Legacy `/faqs` and `/support` redirect to `/help` (`App.jsx:177-178`).

## Assessment
| Aspect | State |
|---|---|
| Documents present | Privacy, Terms, Data protection, Cookies/storage, Community rules |
| MVP accuracy | PASS on the key point — `legalContent.js:269`: *"Payment, escrow, and subscription features are not currently offered"*, matching the MVP exclusions |
| FAQ accuracy | PASS — the brand test asserts the live FAQ says "Validated listings publish immediately" and "Peeks publish automatically" |
| Override mechanism | `legalContentOverrides.js:1-11` corrects exactly **two** paragraphs, both about deletion/export |

## Gaps
- **F-011 (P1)** — the live Privacy Policy and Terms carry unfilled placeholders: `legalContent.js:22` and `:215` *"operated by [TO BE COMPLETED: operator legal name], registered at [TO BE COMPLETED: registered address]"*; `:116` retention periods; `:292` liability cap. The override file does not touch them.
- **F-001** — the entire legal corpus names "FindIt" as the operator of the service.
- Together these mean the binding user agreement names a product that is not launching and an operator that is not identified. Expanded in Phase 13.
