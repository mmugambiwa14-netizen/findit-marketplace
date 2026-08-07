# WP-04 / F-062 — Post-boundary authenticated RPC closure

## Why F-062 reopened

The original authenticated RPC hardening moved 57 privileged public implementations behind private implementations and invoker wrappers. A later 22-RPC extension repeated that boundary for newer features. Subsequent curated-business, Peek fulfilment and no-human-review migrations then added or replaced authenticated-callable public `SECURITY DEFINER` functions.

CI exposed the final-schema drift as two linked symptoms:

- 17 authenticated-callable `public` `SECURITY DEFINER` functions remained.
- only 56 of the 57 original 0101 compatibility functions still satisfied the invoker-wrapper contract.

The missing original wrapper and the 17th privileged identity are the same function: `owner_transition_listing(uuid,text)`. It existed before 0101, was moved to `private` with an invoker wrapper, and was later replaced in-place by the no-human-review migration with a new public privileged implementation.

## Exact final-schema catalogue being closed

The migration is locked to these 17 identities and fails if the catalogue differs:

- `get_my_publishing_access()`
- `submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])`
- `submit_managed_listing_request(text,text,text,text,text,text,text,text)`
- `can_publish_in_category(text)`
- `admin_list_business_applications(text,integer,timestamptz)`
- `admin_review_business_application(uuid,text,text)`
- `admin_review_business_category(uuid,text,text)`
- `admin_list_managed_listing_requests(text,integer,timestamptz)`
- `admin_update_managed_listing_request(uuid,text,text,uuid)`
- `respond_to_business_application(uuid,text)`
- `request_additional_business_categories(text[])`
- `get_my_managed_listing_requests()`
- `accept_peek_request(uuid)`
- `cancel_peek_request_fulfilment(uuid,text)`
- `queue_response_peek_binding(uuid,uuid)`
- `seller_peek_request_queue(bigint,timestamptz,uuid,integer)`
- `owner_transition_listing(uuid,text)`

## Repair

`20260807042000_close_post_boundary_authenticated_rpc_drift.sql` snapshots the current authoritative definitions and role grants before changing anything. For each locked identity it installs the latest implementation in `private`, including replacing older private implementations where later feature work changed behavior. It then converts the public function in-place to a SECURITY INVOKER SQL wrapper with an empty search path and preserves argument defaults, result shape, volatility, strictness, parallel classification, cost/rows and named-role execution grants.

Where an older private implementation has an incompatible result shape, the migration removes only that stale private identity before installing the current authoritative definition. This is required for the evolved seller Peek queue return contract; unexpected dependencies cause the migration to fail rather than cascade.

`owner_transition_listing` retains its original `findit:0101-authenticated-boundary` comment so the original 57-wrapper certification remains authoritative. Genuinely later functions receive the new closure marker.

## Non-goals

This repair does not grant direct authenticated table writes, disable curated publishing, restore human listing moderation, restore Peek moderation, revive retired offset RPCs, weaken admin MFA/founder authorization, or change product behavior. It changes only where privileged RPC bodies execute.

## Proof gate

Do not close F-062 until clean CI proves all of the following:

- zero authenticated-callable public `SECURITY DEFINER` functions;
- all 57 original 0101 wrappers are again invoker SQL wrappers;
- each locked later RPC has a privileged private implementation and an invoker public wrapper;
- existing authenticated/service-role/anon grant matrices remain unchanged;
- the wider database matrix continues past the authenticated-RPC suite.
