# F-069 — Align support certification with live keyset admin API

Status: **PARTIAL until clean-database CI passes**

## Failure

Migration Gates run `31150080956` reached `v1_contact_support.sql` after the marketplace-view suite passed 21/21. The support test still called the retired offset RPC `admin_support_request_rows(...)` and expected the old in-function error `admin access required`.

Migration `20260805033000_disable_legacy_offset_admin_rpcs.sql` intentionally revoked EXECUTE on that offset endpoint from authenticated clients. The database therefore correctly returned `42501: permission denied for function admin_support_request_rows` before entering the legacy function body.

## Repair

- Keep an explicit assertion that the retired offset RPC is unreachable.
- Exercise ordinary-user authorization through the live `admin_support_request_rows_page(...)` keyset RPC and retain the expected `admin access required` rejection there.
- Exercise admin search and selection through the live keyset RPC.
- Replace the obsolete exact-total assertion with the keyset `limit + 1` pagination-sentinel contract.
- Resolve the support request selected through the live page and preserve the existing redacted audit assertion.

## Deliberately not done

- EXECUTE is not restored on the retired offset RPC.
- No admin authorization check is weakened.
- No exact-count/offset behavior is reintroduced.
