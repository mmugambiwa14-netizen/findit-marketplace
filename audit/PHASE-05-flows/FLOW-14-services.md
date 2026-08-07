# FLOW-14 — Services (create, edit, discover, contact)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
Public: `/services` → `Services.jsx`; `/service/:id` → `ServiceDetail.jsx`.
Owner: `/create-service` → **`CuratedCreateService.jsx`** (`App.jsx:186`); `/my-services` → `MyServices.jsx`.
Repository: `servicesRepository` (also a consumer of `public.categories`).

## Assessment
| Aspect | State |
|---|---|
| Taxonomy | 4 service leaves: `property_developer`, `mechanic`, `construction`, `geological` |
| Contact boundary | PASS — `services.contact_*` revoked from `anon` (`0109:52`) and `authenticated` (`0115:187`); `has_contact_*` generated columns drive affordances |
| Money | `services_price_nonnegative` (`0013:179`) |
| Attributes | `services.attributes` exists and is **never written** (F-020) |
| Business binding | `services.provider_id`; verified-business linkage per FLOW-13 |

## Gaps
- *(An earlier suspicion that `src/pages/CreateService.jsx` was unrouted dead code was **withdrawn**: it is imported and wrapped by `CuratedCreateService.jsx:5`, which is what `App.jsx:186` routes. The curated page composes the base form rather than duplicating it.)*
- `VITE_FEATURE_SERVICE_RADIUS` defaults false, so service area is coarse.
- Only 4 service categories for a marketplace positioning "services related to those assets" as a core vertical.
