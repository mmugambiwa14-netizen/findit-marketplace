-- 0041_v1_public_search_and_notification_scale.sql
-- High-volume public browse and essential-notification hardening.
-- Ordinary browse no longer requests exact counts or deep offsets. Saved-item
-- fan-out is queued and processed in bounded batches instead of running inside
-- a listing status transaction.

-- ---------------------------------------------------------------------------
-- Public listing search: generated document, hot-path indexes, keyset RPC
-- ---------------------------------------------------------------------------

alter table public.listings
  add column if not exists search_document tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

create index if not exists idx_listings_search_document
  on public.listings using gin(search_document);
create index if not exists idx_listings_public_newest
  on public.listings(kind, created_at desc, id desc)
  where status in ('available', 'under_offer');
create index if not exists idx_listings_public_price_asc
  on public.listings(kind, price asc, id asc)
  where status in ('available', 'under_offer');
create index if not exists idx_listings_public_price_desc
  on public.listings(kind, price desc, id desc)
  where status in ('available', 'under_offer');
create index if not exists idx_listings_public_views
  on public.listings(kind, views desc, id desc)
  where status in ('available', 'under_offer');
create index if not exists idx_listings_public_location
  on public.listings(kind, location_id, created_at desc, id desc)
  where status in ('available', 'under_offer');
create index if not exists idx_property_details_bedrooms
  on public.property_details(bedrooms, listing_id);
create index if not exists idx_car_details_public_filters
  on public.car_details(brand, condition, fuel_type, transmission, listing_id);
create index if not exists idx_machinery_details_public_filters
  on public.machinery_details(brand, condition, listing_id);

create or replace function public.public_listing_search_page(
  p_kind text,
  p_query text default '',
  p_category text default '',
  p_location_id text default '',
  p_min_price numeric default 0,
  p_max_price numeric default 500000,
  p_min_bedrooms integer default null,
  p_brand text default '',
  p_condition text default '',
  p_fuel_type text default '',
  p_transmission text default '',
  p_sort text default 'newest',
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  kind text,
  seller_id uuid,
  seller_name text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text,
  title text,
  description text,
  price numeric,
  currency text,
  deposit numeric,
  agent_fee numeric,
  additional_fees numeric,
  accepts_offers boolean,
  variants jsonb,
  photos jsonb,
  latitude numeric,
  longitude numeric,
  category text,
  listing_type text,
  status text,
  created_via text,
  views integer,
  created_at timestamptz,
  updated_at timestamptz,
  location jsonb,
  car_details jsonb,
  property_details jsonb,
  machinery_details jsonb,
  cursor_value text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
  cursor_time timestamptz;
  cursor_number numeric;
  cursor_views integer;
begin
  if p_kind not in ('property', 'car', 'machinery')
    or p_sort not in ('newest', 'price_asc', 'price_desc', 'most_viewed')
    or p_limit not between 1 and 50
    or p_min_price < 0
    or p_max_price < p_min_price
    or char_length(normalized_query) > 100
    or char_length(coalesce(p_category, '')) > 80
    or char_length(coalesce(p_location_id, '')) > 64
    or char_length(coalesce(p_brand, '')) > 80
    or char_length(coalesce(p_condition, '')) > 40
    or char_length(coalesce(p_fuel_type, '')) > 40
    or char_length(coalesce(p_transmission, '')) > 40
    or ((p_cursor_value is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid public listing search page' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  if p_cursor_value is not null then
    begin
      if p_sort = 'newest' then cursor_time := p_cursor_value::timestamptz;
      elsif p_sort in ('price_asc', 'price_desc') then cursor_number := p_cursor_value::numeric;
      else cursor_views := p_cursor_value::integer;
      end if;
    exception when others then
      raise exception 'invalid public listing cursor' using errcode = '22023';
    end;
  end if;

  return query
  select
    l.id,
    l.kind::text,
    l.seller_id,
    l.seller_name,
    l.contact_phone,
    l.contact_whatsapp,
    l.contact_email,
    l.title,
    l.description,
    l.price,
    l.currency,
    l.deposit,
    l.agent_fee,
    l.additional_fees,
    l.accepts_offers,
    l.variants,
    l.photos,
    l.latitude,
    l.longitude,
    l.category,
    l.listing_type,
    l.status::text,
    l.created_via::text,
    l.views,
    l.created_at,
    l.updated_at,
    case when loc.id is null then null else jsonb_build_object('id', loc.id, 'name', loc.name, 'type', loc.type) end,
    case when cd.listing_id is null then null else jsonb_build_object(
      'brand', cd.brand, 'model', cd.model, 'year', cd.year, 'mileage', cd.mileage,
      'fuel_type', cd.fuel_type, 'transmission', cd.transmission, 'condition', cd.condition
    ) end,
    case when pd.listing_id is null then null else jsonb_build_object(
      'property_type', pd.property_type, 'bedrooms', pd.bedrooms,
      'bathrooms', pd.bathrooms, 'size_sqm', pd.size_sqm
    ) end,
    case when md.listing_id is null then null else jsonb_build_object(
      'machinery_type', md.machinery_type, 'brand', md.brand, 'model', md.model,
      'condition', md.condition, 'year', md.year, 'usage_hours', md.usage_hours
    ) end,
    case p_sort
      when 'newest' then l.created_at::text
      when 'price_asc' then l.price::text
      when 'price_desc' then l.price::text
      else l.views::text
    end
  from public.listings l
  left join public.locations loc on loc.id = l.location_id
  left join public.car_details cd on cd.listing_id = l.id
  left join public.property_details pd on pd.listing_id = l.id
  left join public.machinery_details md on md.listing_id = l.id
  where l.kind::text = p_kind
    and l.status in ('available', 'under_offer')
    and l.price between p_min_price and p_max_price
    and (coalesce(p_category, '') = '' or l.category = p_category)
    and (coalesce(p_location_id, '') = '' or l.location_id::text = p_location_id)
    and (
      normalized_query = ''
      or l.search_document @@ websearch_to_tsquery('simple'::regconfig, normalized_query)
      or l.title ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (
      (p_kind = 'property' and pd.listing_id is not null and (p_min_bedrooms is null or pd.bedrooms >= p_min_bedrooms))
      or (p_kind = 'car' and cd.listing_id is not null
        and (coalesce(p_brand, '') = '' or cd.brand = p_brand)
        and (coalesce(p_condition, '') = '' or cd.condition = p_condition)
        and (coalesce(p_fuel_type, '') = '' or cd.fuel_type::text = p_fuel_type)
        and (coalesce(p_transmission, '') = '' or cd.transmission::text = p_transmission))
      or (p_kind = 'machinery' and md.listing_id is not null
        and (coalesce(p_brand, '') = '' or md.brand = p_brand)
        and (coalesce(p_condition, '') = '' or md.condition::text = p_condition))
    )
    and (
      p_cursor_id is null
      or (p_sort = 'newest' and (l.created_at, l.id) < (cursor_time, p_cursor_id))
      or (p_sort = 'price_asc' and (l.price, l.id) > (cursor_number, p_cursor_id))
      or (p_sort = 'price_desc' and (l.price, l.id) < (cursor_number, p_cursor_id))
      or (p_sort = 'most_viewed' and (l.views, l.id) < (cursor_views, p_cursor_id))
    )
  order by
    case when p_sort = 'newest' then l.created_at end desc,
    case when p_sort = 'price_asc' then l.price end asc,
    case when p_sort = 'price_desc' then l.price end desc,
    case when p_sort = 'most_viewed' then l.views end desc,
    case when p_sort = 'price_asc' then l.id end asc,
    case when p_sort <> 'price_asc' then l.id end desc
  limit p_limit + 1;
end;
$$;

revoke all on function public.public_listing_search_page(text, text, text, text, numeric, numeric, integer, text, text, text, text, text, text, uuid, integer) from public;
grant execute on function public.public_listing_search_page(text, text, text, text, numeric, numeric, integer, text, text, text, text, text, text, uuid, integer) to anon, authenticated;

comment on function public.public_listing_search_page(text, text, text, text, numeric, numeric, integer, text, text, text, text, text, text, uuid, integer) is
  'Public bounded listing read model. Returns limit+1 rows for keyset traversal and never executes an exact count.';

-- ---------------------------------------------------------------------------
-- Essential notifications: keyset reads and Tour lifecycle events
-- ---------------------------------------------------------------------------

alter table public.app_alerts drop constraint if exists app_alerts_v1_event_type_check;
alter table public.app_alerts add constraint app_alerts_v1_event_type_check check (
  event_type is null or event_type in (
    'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable'
  )
);

create or replace function public.is_safe_notification_link(p_link text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_link is null or (
    length(p_link) between 1 and 200
    and (
      p_link in ('/my-listings', '/profile', '/settings', '/chats', '/saved')
      or p_link ~ '^/(property|car|machinery|service|chats|messages)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  );
$$;

create or replace function public.create_essential_notification(
  p_user_id uuid,
  p_event_type text,
  p_source_key text,
  p_title text,
  p_message text,
  p_link text default null,
  p_listing_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_id uuid;
  normalized_title text := trim(coalesce(p_title, ''));
  normalized_message text := trim(coalesce(p_message, ''));
  normalized_source text := trim(coalesce(p_source_key, ''));
begin
  if p_event_type not in (
    'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable'
  ) then
    raise exception 'unsupported notification event' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'notification recipient not found' using errcode = 'P0002';
  end if;
  if length(normalized_source) not between 1 and 200
    or length(normalized_title) not between 1 and 120
    or length(normalized_message) not between 1 and 1000
    or not public.is_safe_notification_link(p_link)
  then
    raise exception 'notification payload is invalid' using errcode = '22023';
  end if;
  if p_listing_id is not null and not exists (select 1 from public.listings where id = p_listing_id) then
    raise exception 'notification listing not found' using errcode = 'P0002';
  end if;

  insert into public.app_alerts (
    user_id, title, message, type, link, listing_id, event_type, source_key
  ) values (
    p_user_id, normalized_title, normalized_message,
    case when p_event_type = 'account_status' then 'system'::alert_type else 'status_change'::alert_type end,
    p_link, p_listing_id, p_event_type, normalized_source
  )
  on conflict (user_id, event_type, source_key)
    where event_type is not null and source_key is not null
  do nothing
  returning id into alert_id;

  if alert_id is null then
    select id into alert_id from public.app_alerts
    where user_id = p_user_id and event_type = p_event_type and source_key = normalized_source;
  end if;
  return alert_id;
end;
$$;

revoke all on function public.create_essential_notification(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.is_safe_notification_link(text) from public, anon, authenticated;

create index if not exists idx_app_alerts_owner_cursor
  on public.app_alerts(user_id, created_at desc, id desc)
  where event_type is not null;
create index if not exists idx_app_alerts_owner_unread_cursor
  on public.app_alerts(user_id, created_at desc, id desc)
  where event_type is not null and not is_read;

-- Keep the legacy offset RPC rollback-safe by withholding the new event types
-- from older clients that do not know how to render them.
create or replace function public.notification_rows(
  p_event_type text default 'all',
  p_unread_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  notification_id uuid,
  event_type text,
  title text,
  message text,
  link text,
  is_read boolean,
  read_at timestamptz,
  listing_id uuid,
  created_at timestamptz,
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
  if p_event_type not in (
    'all', 'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status'
  ) or p_limit not between 1 and 100 or p_offset not between 0 and 1000000 then
    raise exception 'invalid notification page' using errcode = '22023';
  end if;

  return query
  select a.id, a.event_type, a.title, a.message,
    case when public.is_safe_notification_link(a.link) then a.link else null end,
    a.is_read, a.read_at, a.listing_id, a.created_at, count(*) over()
  from public.app_alerts a
  where a.user_id = auth.uid()
    and a.event_type in (
      'listing_approved', 'listing_rejected', 'listing_expires_soon',
      'report_resolved', 'account_status'
    )
    and (p_event_type = 'all' or a.event_type = p_event_type)
    and (not p_unread_only or not a.is_read)
  order by a.created_at desc, a.id desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.notification_rows(text, boolean, integer, integer) from public, anon;
grant execute on function public.notification_rows(text, boolean, integer, integer) to authenticated;

create or replace function public.notification_rows_page(
  p_event_type text default 'all',
  p_unread_only boolean default false,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  notification_id uuid,
  event_type text,
  title text,
  message text,
  link text,
  is_read boolean,
  read_at timestamptz,
  listing_id uuid,
  created_at timestamptz
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
  if p_event_type not in (
    'all', 'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable'
  ) or p_limit not between 1 and 50
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid notification page' using errcode = '22023';
  end if;

  return query
  select a.id, a.event_type, a.title, a.message,
    case when public.is_safe_notification_link(a.link) then a.link else null end,
    a.is_read, a.read_at, a.listing_id, a.created_at
  from public.app_alerts a
  where a.user_id = auth.uid()
    and a.event_type is not null
    and (p_event_type = 'all' or a.event_type = p_event_type)
    and (not p_unread_only or not a.is_read)
    and (p_cursor_at is null or (a.created_at, a.id) < (p_cursor_at, p_cursor_id))
  order by a.created_at desc, a.id desc
  limit p_limit + 1;
end;
$$;

revoke all on function public.notification_rows_page(text, boolean, timestamptz, uuid, integer) from public, anon;
grant execute on function public.notification_rows_page(text, boolean, timestamptz, uuid, integer) to authenticated;

create or replace function public.notify_tour_owner_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_link text;
  parent_title text;
  parent_listing uuid;
begin
  if new.listing_id is not null then
    select '/' || l.kind::text || '/' || l.id::text, l.title, l.id
      into parent_link, parent_title, parent_listing
    from public.listings l where l.id = new.listing_id;
  else
    select '/service/' || s.id::text, s.title, null
      into parent_link, parent_title, parent_listing
    from public.services s where s.id = new.service_id;
  end if;
  if parent_link is null then return new; end if;

  if new.status = 'ready' and new.moderation_status = 'approved'
    and (old.status is distinct from 'ready' or old.moderation_status is distinct from 'approved')
  then
    perform public.create_essential_notification(
      new.owner_id, 'tour_ready', 'tour-ready:' || new.id::text,
      'Tour ready', coalesce(parent_title, 'Your listing') || ' now has a public Tour.',
      parent_link, parent_listing
    );
  end if;
  if new.status = 'failed' and old.status is distinct from 'failed' then
    perform public.create_essential_notification(
      new.owner_id, 'tour_failed', 'tour-failed:' || new.id::text || ':' || new.processing_attempts::text,
      'Tour processing failed', 'Your listing remains available. Review the Tour and retry the upload.',
      parent_link, parent_listing
    );
  end if;
  if new.moderation_status = 'rejected' and old.moderation_status is distinct from 'rejected' then
    perform public.create_essential_notification(
      new.owner_id, 'tour_rejected', 'tour-rejected:' || new.id::text || ':' || coalesce(new.updated_at, now())::text,
      'Tour rejected', coalesce(new.rejection_reason, 'The Tour did not pass manual review.'),
      parent_link, parent_listing
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listing_tours_owner_notifications on public.listing_tours;
create trigger trg_listing_tours_owner_notifications
  after update of status, moderation_status on public.listing_tours
  for each row execute function public.notify_tour_owner_lifecycle();

-- ---------------------------------------------------------------------------
-- Saved-listing unavailability uses a bounded asynchronous fan-out queue.
-- ---------------------------------------------------------------------------

create table public.essential_notification_fanout_jobs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  event_type text not null check (event_type = 'saved_listing_unavailable'),
  listing_status text not null,
  state text not null default 'pending' check (state in ('pending', 'claimed', 'completed', 'dead_lettered')),
  cursor_user_id uuid,
  attempts integer not null default 0 check (attempts between 0 and 10),
  claim_token uuid,
  claimed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_notification_fanout_due
  on public.essential_notification_fanout_jobs(next_attempt_at, created_at, id)
  where state = 'pending';
create index if not exists idx_saved_listings_listing_user
  on public.saved_listings(listing_id, user_id);

alter table public.essential_notification_fanout_jobs enable row level security;
revoke all on table public.essential_notification_fanout_jobs from anon, authenticated;

create or replace function public.queue_saved_listing_unavailable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('available', 'under_offer') and new.status not in ('available', 'under_offer') then
    insert into public.essential_notification_fanout_jobs(listing_id, event_type, listing_status)
    values (new.id, 'saved_listing_unavailable', new.status::text);
    perform public.create_essential_notification(
      new.seller_id, 'listing_status_changed',
      'listing-status:' || new.id::text || ':' || new.status::text || ':' || new.updated_at::text,
      'Listing status changed', new.title || ' is now ' || replace(new.status::text, '_', ' ') || '.',
      '/' || new.kind::text || '/' || new.id::text, new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listing_saved_unavailable_fanout on public.listings;
create trigger trg_listing_saved_unavailable_fanout
  after update of status on public.listings
  for each row execute function public.queue_saved_listing_unavailable();

create or replace function public.claim_notification_fanout_jobs(
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns table (job_id uuid, claim_token uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' or p_limit not between 1 and 25 or p_lease_seconds not between 30 and 600 then
    raise exception 'invalid notification fanout claim' using errcode = '42501';
  end if;

  update public.essential_notification_fanout_jobs j
  set state = case when attempts >= 5 then 'dead_lettered' else 'pending' end,
      claim_token = null, claimed_at = null,
      next_attempt_at = case when attempts >= 5 then next_attempt_at else now() end,
      updated_at = now(), error_code = 'lease_expired'
  where j.state = 'claimed' and j.claimed_at < now() - make_interval(secs => p_lease_seconds);

  return query
  with candidates as (
    select j.id from public.essential_notification_fanout_jobs j
    where j.state = 'pending' and j.next_attempt_at <= now()
    order by j.next_attempt_at, j.created_at, j.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.essential_notification_fanout_jobs j
    set state = 'claimed', claim_token = gen_random_uuid(), claimed_at = now(),
        attempts = attempts + 1, updated_at = now(), error_code = null
    from candidates c where j.id = c.id
    returning j.id, j.claim_token
  )
  select claimed.id, claimed.claim_token from claimed;
end;
$$;

create or replace function public.process_notification_fanout_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_recipient_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job public.essential_notification_fanout_jobs%rowtype;
  listing_row public.listings%rowtype;
  recipient record;
  processed integer := 0;
  last_user uuid;
  has_more boolean := false;
begin
  if auth.role() <> 'service_role' or p_recipient_limit not between 1 and 500 then
    raise exception 'invalid notification fanout batch' using errcode = '42501';
  end if;
  select * into job from public.essential_notification_fanout_jobs
  where id = p_job_id and state = 'claimed' and claim_token = p_claim_token
  for update;
  if not found then raise exception 'notification fanout claim not found' using errcode = 'P0002'; end if;
  select * into listing_row from public.listings where id = job.listing_id;
  if not found then
    update public.essential_notification_fanout_jobs set state = 'completed', completed_at = now(), updated_at = now()
    where id = job.id;
    return jsonb_build_object('processed', 0, 'complete', true);
  end if;

  for recipient in
    select s.user_id from public.saved_listings s
    where s.listing_id = job.listing_id and (job.cursor_user_id is null or s.user_id > job.cursor_user_id)
    order by s.user_id
    limit p_recipient_limit + 1
  loop
    if processed >= p_recipient_limit then has_more := true; exit; end if;
    perform public.create_essential_notification(
      recipient.user_id, 'saved_listing_unavailable',
      'saved-unavailable:' || job.id::text || ':' || recipient.user_id::text,
      'Saved listing unavailable', listing_row.title || ' is no longer available.',
      '/saved', listing_row.id
    );
    processed := processed + 1;
    last_user := recipient.user_id;
  end loop;

  update public.essential_notification_fanout_jobs
  set cursor_user_id = coalesce(last_user, cursor_user_id),
      state = case when has_more then 'pending' else 'completed' end,
      next_attempt_at = case when has_more then now() else next_attempt_at end,
      claim_token = null, claimed_at = null, updated_at = now(),
      completed_at = case when has_more then null else now() end
  where id = job.id;

  return jsonb_build_object('processed', processed, 'complete', not has_more, 'nextCursor', last_user);
end;
$$;

create or replace function public.fail_notification_fanout_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' or char_length(trim(coalesce(p_error_code, ''))) not between 1 and 120 then
    raise exception 'invalid notification fanout failure' using errcode = '42501';
  end if;
  update public.essential_notification_fanout_jobs
  set state = case when attempts >= 5 then 'dead_lettered' else 'pending' end,
      next_attempt_at = now() + make_interval(secs => least(3600, (30 * power(2::numeric, greatest(attempts - 1, 0)))::integer)),
      claim_token = null, claimed_at = null, error_code = trim(p_error_code), updated_at = now()
  where id = p_job_id and state = 'claimed' and claim_token = p_claim_token;
  if not found then raise exception 'notification fanout claim not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.claim_notification_fanout_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.process_notification_fanout_job(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.fail_notification_fanout_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_notification_fanout_jobs(integer, integer) to service_role;
grant execute on function public.process_notification_fanout_job(uuid, uuid, integer) to service_role;
grant execute on function public.fail_notification_fanout_job(uuid, uuid, text) to service_role;


-- Compact fan-out telemetry and founder-visible queue health. No recipient IDs,
-- listing titles, notification bodies, or source keys are copied into metrics.
create index if not exists idx_notification_fanout_active_state
  on public.essential_notification_fanout_jobs(state, next_attempt_at, created_at)
  where state <> 'completed';

create or replace function public.record_notification_fanout_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state = 'claimed' and old.state is distinct from 'claimed' then
    perform public.record_operational_metric_internal(
      'notification_fanout_claimed', 1, 'saved_listing_unavailable', 1, '{}'::jsonb, now()
    );
  elsif new.state = 'completed' and old.state is distinct from 'completed' then
    perform public.record_operational_metric_internal(
      'notification_fanout_completed_latency_ms',
      greatest(extract(epoch from (coalesce(new.completed_at, now()) - new.created_at)) * 1000, 0),
      'saved_listing_unavailable', 1, jsonb_build_object('attempts', new.attempts),
      coalesce(new.completed_at, now())
    );
  elsif new.state = 'dead_lettered' and old.state is distinct from 'dead_lettered' then
    perform public.record_operational_metric_internal(
      'notification_fanout_failed', 1, 'saved_listing_unavailable', 1,
      jsonb_build_object('attempts', new.attempts, 'error_code', coalesce(new.error_code, 'unknown')),
      now()
    );
  end if;
  return new;
end;
$$;

create trigger trg_notification_fanout_metrics
  after update of state on public.essential_notification_fanout_jobs
  for each row execute function public.record_notification_fanout_metrics();

revoke all on function public.record_notification_fanout_metrics() from public, anon, authenticated;

-- Queue health alerts, founder summaries, and completed-job retention are
-- added by migration 0042 after the base fan-out queue and metric trigger exist.
