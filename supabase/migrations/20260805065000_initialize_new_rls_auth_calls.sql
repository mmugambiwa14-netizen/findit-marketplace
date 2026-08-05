begin;

-- Preserve the current authorization predicates while forcing PostgreSQL to
-- initialize auth.uid() once per statement rather than once per candidate row.
-- These policies were added after the original 36-policy RLS plan lock.

drop policy if exists contact_reveal_events_own_read on public.contact_reveal_events;
create policy contact_reveal_events_own_read
  on public.contact_reveal_events
  for select
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists peek_requests_participant_read on public.peek_requests;
create policy peek_requests_participant_read
  on public.peek_requests
  for select
  using (
    requester_id = (select auth.uid())
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

drop policy if exists peek_requests_create on public.peek_requests;
create policy peek_requests_create
  on public.peek_requests
  for insert
  with check (
    public.is_active_user()
    and requester_id = (select auth.uid())
    and status = 'pending'
    and moderation_status = 'pending'
    and supporter_count = 0
    and current_response_id is null
    and merged_into_id is null
    and answered_at is null
    and declined_at is null
    and (listing_id is null or not exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = (select auth.uid())
    ))
    and (service_id is null or not exists (
      select 1
      from public.services s
      where s.id = service_id
        and s.provider_id = (select auth.uid())
    ))
  );

drop policy if exists peek_request_supporters_own_read on public.peek_request_supporters;
create policy peek_request_supporters_own_read
  on public.peek_request_supporters
  for select
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists peek_request_supporters_create on public.peek_request_supporters;
create policy peek_request_supporters_create
  on public.peek_request_supporters
  for insert
  with check (
    public.is_active_user()
    and user_id = (select auth.uid())
    and private.can_support_peek_request(request_id)
  );

drop policy if exists peek_request_supporters_withdraw on public.peek_request_supporters;
create policy peek_request_supporters_withdraw
  on public.peek_request_supporters
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists users_manage_own_web_push_subscriptions on public.web_push_subscriptions;
create policy users_manage_own_web_push_subscriptions
  on public.web_push_subscriptions
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;
