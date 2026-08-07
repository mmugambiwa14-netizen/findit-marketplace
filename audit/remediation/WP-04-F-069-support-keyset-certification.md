# F-069 — Align support certification with live keyset admin API

Status: **PARTIAL until clean-database CI passes**

## First failure: retired offset RPC

Migration Gates run `31150080956` reached `v1_contact_support.sql` after the marketplace-view suite passed 21/21. The support test still called the retired offset RPC `admin_support_request_rows(...)` and expected the old in-function error `admin access required`.

Migration `20260805033000_disable_legacy_offset_admin_rpcs.sql` intentionally revoked EXECUTE on that offset endpoint from authenticated clients. The database therefore correctly returned `42501: permission denied for function admin_support_request_rows` before entering the legacy function body.

The test was migrated to the live `admin_support_request_rows_page(...)` keyset API while retaining an explicit assertion that the old offset endpoint stays unreachable.

## Second failure: stale SQL admin fixture

Migration Gates run `31150559866` then passed the first seven support assertions, including:

- guest support-table isolation;
- bounded support submission and rate limiting;
- denial of the retired offset RPC; and
- `admin access required` for an ordinary authenticated caller using the live keyset RPC.

The first admin keyset query then correctly failed because the fixture set only `role='admin'`. Since migration `0030_v1_founder_admin_lock.sql`, founder-operated V1 requires an active user with both `role='admin'` and `super_admin=true`, plus founder identity or the explicit direct-`postgres` deterministic SQL-test/recovery boundary. The later MFA migration adds assurance requirements without weakening that founder lock.

## Repair

- Keep an explicit assertion that the retired offset RPC is unreachable.
- Exercise ordinary-user authorization through the live `admin_support_request_rows_page(...)` keyset RPC.
- Make the deterministic SQL admin fixture satisfy the existing `role='admin' + super_admin=true` founder-lock contract under the documented direct-`postgres` test boundary.
- Exercise admin search and selection through the live keyset RPC.
- Replace the obsolete exact-total assertion with the keyset `limit + 1` pagination-sentinel contract.
- Resolve the support request selected through the live page and preserve the existing redacted audit assertion.

## Deliberately not done

- EXECUTE is not restored on the retired offset RPC.
- Founder identity, `super_admin`, or MFA requirements are not weakened.
- No browser-session admin shortcut is introduced.
- No exact-count/offset behavior is reintroduced.
