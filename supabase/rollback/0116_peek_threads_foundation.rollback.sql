-- 0116_peek_threads_foundation.rollback.sql
--
-- Disables Peek Threads without destroying anything.
--
-- The three tables are LEFT IN PLACE. Removing them would discard every buyer
-- request, every "I want this too" and every response binding -- community
-- contributions that cannot be reconstructed. A rollback exists to stop a
-- feature misbehaving, not to erase what users wrote.
--
-- Revoking the grants makes the tables unreachable from any browser client, so
-- the feature is off from the product's point of view while the data waits.
--
-- listing_tours.peek_kind is also left in place. It defaults to 'main', so
-- every row keeps the meaning it had before 0116 and any build that predates
-- the column simply ignores it.
--
-- The slot guard is dropped, because it references peek_kind semantics that
-- only matter while the feature is live. The Main Listing Peek slot behaves
-- exactly as it did before 0116 once it is gone.
--
-- To remove the tables as well, do it deliberately and separately, after
-- exporting:
--
--   copy (select * from public.peek_requests) to '/tmp/peek_requests.csv' csv header;
--   copy (select * from public.peek_request_supporters) to '/tmp/peek_supporters.csv' csv header;
--   copy (select * from public.peek_request_responses) to '/tmp/peek_responses.csv' csv header;

revoke all on public.peek_requests from anon, authenticated;
revoke all on public.peek_request_supporters from anon, authenticated;
revoke all on public.peek_request_responses from anon, authenticated;

drop trigger if exists trg_listing_tour_slots_reject_response on public.listing_tour_slots;
drop function if exists private.reject_response_peek_in_slot();
