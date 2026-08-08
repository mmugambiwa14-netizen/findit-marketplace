-- The public and participant visibility predicates are an intentional OR,
-- but separate permissive policies make PostgreSQL plan both independently.
-- Keep the exact visibility union in one initialized policy.

begin;

drop policy if exists peek_requests_public_read on public.peek_requests;
drop policy if exists peek_requests_participant_read on public.peek_requests;
create policy peek_requests_participant_read
  on public.peek_requests
  for select
  using (
    (
      moderation_status = 'approved'
      and status <> 'removed'
      and private.is_peek_parent_public(listing_id, service_id)
    )
    or requester_id = (select auth.uid())
    or public.is_admin()
    or (listing_id is not null and exists (
      select 1
      from public.listings l
      where l.id = peek_requests.listing_id
        and l.seller_id = (select auth.uid())
    ))
    or (service_id is not null and exists (
      select 1
      from public.services s
      where s.id = peek_requests.service_id
        and s.provider_id = (select auth.uid())
    ))
  );

commit;
