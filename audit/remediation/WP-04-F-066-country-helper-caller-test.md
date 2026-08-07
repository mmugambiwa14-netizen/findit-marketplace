# F-066 — Reconcile country-helper behavior test with private caller implementations

Status: **PARTIAL until clean-database CI passes**

## Failure

Migration Gates run `31148806214` applied every migration and passed the 48-policy RLS suite and all 13 F-027 MFA assertions. The runner then stopped at `v1_private_country_helper_implementations.sql` because its fourth assertion searched only the `public` schema for four stored caller bodies and found zero.

## Root cause

The country-helper boundary was originally introduced by migration 0089 while its four callers still lived in `public`. Later security migrations 0097 and 0101 moved those authoritative caller implementations into `private` and recreated public SECURITY INVOKER wrappers. The stored function bodies and their public-helper calls remained intact, but the database test retained the older caller-schema assumption.

## Repair

- Inspect the four authoritative caller implementations in `private`.
- Continue requiring calls through the public country-helper compatibility API.
- Keep helper implementations private and public wrappers invoker-only.
- Add a source contract preventing the pgTAP suite from reverting to public caller-body inspection.

## Deliberately not done

- No function was moved back into the exposed `public` schema.
- No execution grant was broadened.
- No helper-call assertion was removed.
