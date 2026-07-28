-- Roll back Milestone 4 listing/Tour integration while preserving Tour data.

revoke all on function public.public_tour_summaries(uuid[], uuid[]) from public, anon, authenticated, service_role;
drop function if exists public.public_tour_summaries(uuid[], uuid[]);

-- Restore the Milestone 3 public listing, saved-listing and private-image policies.
drop policy if exists "listings_public_read_available" on public.listings;
create policy "listings_public_read_available" on public.listings
  for select using (
    status in ('available', 'under_offer', 'rented')
    or (public.is_active_user() and seller_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "saved_listings_owner_insert" on public.saved_listings;
create policy "saved_listings_owner_insert" on public.saved_listings
  for insert with check (
    public.is_active_user()
    and user_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status in ('available', 'under_offer', 'rented')
    )
  );

drop policy if exists "listing_media_read" on public.listing_media;
create policy "listing_media_read" on public.listing_media
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status in ('available', 'under_offer', 'rented')
    )
  );

drop policy if exists "listing_image_authorized_read" on storage.objects;
create policy "listing_image_authorized_read" on storage.objects
  for select to public using (
    bucket_id = 'listing-images'
    and (
      owner_id = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1
        from public.listing_media m
        join public.listings l on l.id = m.listing_id
        where m.storage_path = name
          and l.status in ('available', 'under_offer', 'rented')
      )
    )
  );

-- Restore Milestone 3 new-conversation eligibility.
create or replace function public.start_listing_conversation(
  p_listing_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row public.listings%rowtype;
  conversation_row public.conversations%rowtype;
  body text := public.normalize_message_body(p_message);
  buyer_name text;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into listing_row from public.listings
   where id = p_listing_id and status in ('available', 'under_offer', 'rented')
   for share;
  if not found then
    raise exception 'listing is unavailable' using errcode = 'P0002';
  end if;
  if listing_row.seller_id = auth.uid() then
    raise exception 'cannot message your own listing' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.users where id = listing_row.seller_id and status = 'active'
  ) then
    raise exception 'seller is unavailable' using errcode = 'P0002';
  end if;

  select full_name into buyer_name from public.users where id = auth.uid();

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (listing_row.id, auth.uid(), listing_row.seller_id)
  on conflict (listing_id, buyer_id) do update set updated_at = now()
  returning * into conversation_row;

  if conversation_row.state <> 'open'
    or conversation_row.buyer_blocked_at is not null
    or conversation_row.seller_blocked_at is not null
    or conversation_row.retention_until <= now()
  then
    raise exception 'conversation is unavailable' using errcode = '42501';
  end if;

  perform public.assert_message_rate_limit();
  insert into public.inquiries (
    listing_id, listing_title, seller_id, buyer_id, buyer_name,
    message, sender_id, conversation_id, status, attachments
  ) values (
    listing_row.id, listing_row.title, listing_row.seller_id, auth.uid(), buyer_name,
    body, auth.uid(), conversation_row.id, 'new', '[]'::jsonb
  );

  update public.conversations
     set last_message_at = now(), last_message_sender_id = auth.uid(),
         buyer_last_seen_at = now()
   where id = conversation_row.id;

  return conversation_row.id;
end;
$$;

-- Restore the original Milestone 3 inbox result shape.
drop function if exists public.message_inbox(text, boolean, integer, integer);
create function public.message_inbox(
  p_query text default '',
  p_unread_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  conversation_id uuid,
  listing_id uuid,
  listing_kind text,
  listing_title text,
  listing_photo text,
  other_user_id uuid,
  other_user_name text,
  last_message text,
  last_message_at timestamptz,
  has_unread boolean,
  is_blocked boolean,
  state text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 or char_length(trim(coalesce(p_query, ''))) > 100 then
    raise exception 'invalid inbox request' using errcode = '22023';
  end if;

  return query
  with rows as (
    select
      c.id as row_conversation_id,
      c.listing_id as row_listing_id,
      l.kind::text as row_listing_kind,
      l.title as row_listing_title,
      l.photos ->> 0 as row_listing_photo,
      other_user.id as row_other_user_id,
      coalesce(other_user.full_name, 'FindIt user') as row_other_user_name,
      latest.message as row_last_message,
      c.last_message_at as row_last_message_at,
      c.last_message_sender_id <> auth.uid()
        and c.last_message_at > coalesce(
          case when c.buyer_id = auth.uid() then c.buyer_last_seen_at else c.seller_last_seen_at end,
          '-infinity'::timestamptz
        ) as row_unread,
      (c.buyer_blocked_at is not null or c.seller_blocked_at is not null) as row_blocked,
      c.state as row_state
    from public.conversations c
    join public.listings l on l.id = c.listing_id
    join public.users other_user on other_user.id = case
      when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
    left join lateral (
      select i.message from public.inquiries i
       where i.conversation_id = c.id
       order by i.created_at desc, i.id desc limit 1
    ) latest on true
    where c.buyer_id = auth.uid() or c.seller_id = auth.uid()
  ), filtered as (
    select * from rows
     where (not p_unread_only or row_unread)
       and (
         trim(coalesce(p_query, '')) = ''
         or row_listing_title ilike '%' || trim(p_query) || '%'
         or row_other_user_name ilike '%' || trim(p_query) || '%'
       )
  )
  select filtered.*, count(*) over()
    from filtered
   order by filtered.row_last_message_at desc nulls last, filtered.row_conversation_id desc
   limit p_limit offset p_offset;
end;
$$;

create or replace function public.message_conversation(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', c.id,
    'listing_id', c.listing_id,
    'listing_kind', l.kind::text,
    'listing_title', l.title,
    'other_user_id', other_user.id,
    'other_user_name', coalesce(other_user.full_name, 'FindIt user'),
    'state', c.state,
    'blocked_by_me', case when c.buyer_id = auth.uid() then c.buyer_blocked_at is not null else c.seller_blocked_at is not null end,
    'is_blocked', c.buyer_blocked_at is not null or c.seller_blocked_at is not null,
    'can_send', c.state = 'open'
      and c.buyer_blocked_at is null and c.seller_blocked_at is null
      and c.retention_until > now()
  ) into result
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  join public.users other_user on other_user.id = case
    when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  where c.id = p_conversation_id
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid());
  return result;
end;
$$;

revoke all on function public.start_listing_conversation(uuid, text) from public, anon;
revoke all on function public.message_inbox(text, boolean, integer, integer) from public, anon;
revoke all on function public.message_conversation(uuid) from public, anon;
grant execute on function public.start_listing_conversation(uuid, text) to authenticated;
grant execute on function public.message_inbox(text, boolean, integer, integer) to authenticated;
grant execute on function public.message_conversation(uuid) to authenticated;

-- Restore status-only cache invalidation triggers.
create or replace function public.emit_listing_tour_parent_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tour uuid;
  reason text;
begin
  if old.status is not distinct from new.status then return new; end if;
  select current_tour_id into current_tour
  from public.listing_tour_slots where listing_id = new.id;
  reason := 'listing_status_' || new.status::text;
  insert into public.tour_cache_invalidations (tour_id, parent_type, parent_id, reason)
  values (current_tour, 'listing', new.id, reason);
  if current_tour is not null then
    update public.listing_tours set published_at = case
      when new.status in ('available', 'under_offer') and status = 'ready' and moderation_status = 'approved'
      then coalesce(published_at, now()) else null end where id = current_tour;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listings_tour_invalidation on public.listings;
create trigger trg_listings_tour_invalidation after update of status on public.listings
for each row execute function public.emit_listing_tour_parent_invalidation();

create or replace function public.emit_service_tour_parent_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tour uuid;
  reason text;
begin
  if old.status is not distinct from new.status then return new; end if;
  select current_tour_id into current_tour
  from public.listing_tour_slots where service_id = new.id;
  reason := 'service_status_' || new.status::text;
  insert into public.tour_cache_invalidations (tour_id, parent_type, parent_id, reason)
  values (current_tour, 'service', new.id, reason);
  if current_tour is not null then
    update public.listing_tours set published_at = case
      when new.status = 'active' and status = 'ready' and moderation_status = 'approved'
      then coalesce(published_at, now()) else null end where id = current_tour;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_services_tour_invalidation on public.services;
create trigger trg_services_tour_invalidation after update of status on public.services
for each row execute function public.emit_service_tour_parent_invalidation();
