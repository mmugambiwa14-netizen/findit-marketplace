# FLOW-03 — Search (text, category, location, price, facets, sort, pagination)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/search` → `src/pages/Search.jsx` (332 LOC) → `src/components/search/*` → `publicListingsRepository`:
- `findPublicListingsPage(...)` → RPC with `p_cursor_value`, `p_cursor_id`, `p_limit` (`:177-179`)
- **keyset pagination** — the comment at `:159` states the database returns `limit+1` rows so the service derives the next cursor
- `findPublicListingTitleSuggestions(kind, term, limit = 5)` (`:191`)
- one `.range(from, to)` offset path remains at `:152`

## Assessment
| Aspect | State |
|---|---|
| Bounded projection | PASS — anon column allowlist |
| Stable pagination | PASS — keyset/cursor with `limit+1` lookahead |
| Public-status filter | PASS — enforced in RLS (`listings_public_read_available`), not only in the query |
| Indexes | `idx_listings_kind_status`, `idx_listings_price`, `idx_listings_title_trgm` (gin_trgm_ops), `idx_listings_location` |
| Leakage | PASS — private/draft rows excluded by policy; contacts and exact coordinates not in the allowlist |

## Gaps
- Mixed pagination strategies (cursor RPC at `:177` and offset `.range()` at `:152`) — the offset path is unstable under concurrent inserts. **F-028 (P3)**.
- Cross-currency comparison: price filtering and sorting operate on `price` with a separate `currency` column. Phase 7 assesses whether mixed-currency result sets can mislead.
- Taxonomy: 121 leaf categories, but facet coverage for the 90 property leaves versus 15 vehicle leaves is uneven (`category-tree.md`).
