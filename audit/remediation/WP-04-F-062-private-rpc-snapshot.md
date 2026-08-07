# F-062 — Correct the historical authenticated RPC snapshot

Status: **PARTIAL until clean-reset CI passes**

## Failure

Migration Gates clean reset stopped in `20260805073000_private_new_authenticated_rpc_implementations.sql` before the F-027 migration. The snapshot expected 23 authenticated `SECURITY DEFINER` functions but discovered 22.

## Root cause

`public.discover_category_counts()` was intentionally created as `SECURITY INVOKER` in migration `20260804104900`. The later private-implementation migration incorrectly listed it among `SECURITY DEFINER` targets while the snapshot query correctly selected only definer functions.

## Repair

- Keep `discover_category_counts()` as `SECURITY INVOKER`.
- Remove it from the locked private-definer target catalogue.
- Correct the expected private/wrapper count from 23 to 22.
- Add a source regression contract protecting the invoker classification and 22-function boundary.

## Deliberately not done

- The discovery function was not promoted to `SECURITY DEFINER` merely to satisfy the stale count.
- The snapshot set comparison was not removed or weakened.
- Named-role grants and wrapper/private implementation checks remain intact for all 22 true targets.
