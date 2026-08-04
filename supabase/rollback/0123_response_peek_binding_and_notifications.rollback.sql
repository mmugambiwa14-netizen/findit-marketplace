drop function if exists public.seller_unbound_response_peeks();
drop function if exists public.response_peek_request_candidates(uuid);
-- Restore the Phase 4 bind_response_peek definition by reapplying migration 0119.
