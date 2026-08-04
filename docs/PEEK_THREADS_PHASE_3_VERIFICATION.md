# Peek Threads Phase 3 Verification

Run on a clean checkout of `feature/peek-threads-phase-3`:

```bash
npm ci
npm run lint
npm run typecheck
node --experimental-strip-types --test tests/peekThreadContracts.test.mjs tests/peekThreadReadContracts.test.mjs
npm run verify:sql-boundary
npm run verify:source-graph
npm run build
```

Hosted database acceptance must additionally prove:

- anonymous and authenticated callers can read approved pending requests on an available listing;
- neither caller receives requester identity;
- answered rows disappear when the Response Peek is removed, rejected or no longer published;
- a private, sold, suspended or unavailable parent returns zero rows;
- listing and service parents cannot be supplied together;
- limits above 50 are bounded;
- repeated pages contain no duplicates for both sort modes;
- playback URLs are still issued only by the existing playback function.

No hosted result is claimed by this document.
