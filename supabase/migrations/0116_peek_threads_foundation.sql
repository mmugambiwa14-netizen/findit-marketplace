-- 0116_peek_threads_foundation.sql
--
-- Peek Threads phase 1: structured visual Q&A attached to a listing.
--
-- This EXTENDS the existing Peek subsystem. It creates no second video
-- pipeline: a Response Peek is an ordinary public.listing_tours row that goes
-- through the same upload, processing, moderation and cleanup path as a Main
-- Listing Peek. See docs/PEEK_THREADS.md.
--
-- The one collision that shapes this migration:
-- public.publish_listing_tour promotes a tour into public.listing_tour_slots
-- and supersedes whatever was there. That is correct for the single Main
-- Listing Peek and wrong for a Response Peek -- answering "show the rear
-- tyres" must never destroy the seller's walkaround video. A `peek_kind`
-- discriminator and a slot guard keep the two apart.

-- 1. Discriminator on the existing tour table ------------------------------
-- Defaults to 'main', so every row that exists today keeps exactly the meaning
-- it has now and no backfill is required.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'peek_kind') then
    create type public.peek_kind as enum ('main', 'response');
  end if;
end
$$;

alter table public.listing_tours
  add column if not exists peek_kind public.peek_kind not null default 'main';

comment on column public.listing_tours.peek_kind is
  'main = the single Listing Peek promoted into listing_tour_slots. '
  'response = a Peek answering one or more peek_requests; never enters a slot.';

-- 2. Request vocabulary ----------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'peek_request_category') then
    create type public.peek_request_category as enum (
      'condition',
      'operation',
      'close_up',
      'measurements',
      'surroundings',
      'availability',
      'demonstration',
      'documentation',
      'custom'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'peek_request_status') then
    create type public.peek_request_status as enum (
      'pending',
      'answered',
      'declined',
      'expired',
      'merged',
      'removed'
    );
  end if;
end
$$;

-- 3. The request -----------------------------------------------------------

create table if not exists public.peek_requests (
  id uuid primary key default gen_random_uuid(),

  -- Mirrors the listing_tour_slots shape: a request belongs to exactly one
  -- parent, either a listing or a service.
  listing_id uuid references public.listings (id) on delete cascade,
  service_id uuid references public.services (id) on delete cascade,

  requester_id uuid not null references public.users (id) on delete cascade,

  category public.peek_request_category not null,
  body text not null,

  status public.peek_request_status not null default 'pending',

  -- Set when this request is folded into another rather than answered.
  merged_into_id uuid references public.peek_requests (id) on delete set null,

  -- Denormalized. Counting supporters per card would be an N+1 across every
  -- thread on a busy listing; this is the value ranking reads. Maintained by
  -- trigger below, never written by a client.
  supporter_count integer not null default 0,

  -- The Response Peek currently answering this request. History lives in
  -- peek_request_responses, so replacing this loses nothing.
  current_response_id uuid references public.listing_tours (id) on delete set null,

  moderation_status text not null default 'pending',
  moderation_reason text,

  answered_at timestamptz,
  declined_at timestamptz,
  decline_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint peek_requests_single_parent check (
    (listing_id is not null and service_id is null)
    or (listing_id is null and service_id is not null)
  ),
  -- Bounds enforced here as well as in the client contract, because the client
  -- runs in a browser and can be bypassed entirely.
  constraint peek_requests_body_length check (
    char_length(btrim(body)) between 8 and 280
  ),
  constraint peek_requests_decline_reason_length check (
    decline_reason is null or char_length(decline_reason) <= 280
  ),
  constraint peek_requests_supporter_count_nonnegative check (supporter_count >= 0),
  constraint peek_requests_moderation_status check (
    moderation_status in ('pending', 'approved', 'rejected')
  ),
  -- A merged request must name its target, and nothing else may.
  constraint peek_requests_merge_consistency check (
    (status = 'merged') = (merged_into_id is not null)
  ),
  constraint peek_requests_no_self_merge check (merged_into_id is null or merged_into_id <> id)
);

-- 4. Supporters -- "I want this too" ---------------------------------------
-- The composite primary key IS the one-vote-per-buyer rule. Enforcing it in
-- the database means no application path can double-count.

create table if not exists public.peek_request_supporters (
  request_id uuid not null references public.peek_requests (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

-- 5. Response binding ------------------------------------------------------
-- Many-to-many on purpose: one Response Peek may answer several requests, and
-- a request may accumulate several responses over time. `is_current` marks the
-- live one; superseded rows remain, which is how a replacement keeps history.

create table if not exists public.peek_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.peek_requests (id) on delete cascade,
  tour_id uuid not null references public.listing_tours (id) on delete cascade,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  constraint peek_request_responses_unique_pair unique (request_id, tour_id),
  constraint peek_request_responses_superseded_consistency check (
    is_current = (superseded_at is null)
  )
);

-- At most one current response per request.
create unique index if not exists idx_peek_request_responses_one_current
  on public.peek_request_responses (request_id)
  where is_current;

-- 6. Counter maintenance ---------------------------------------------------

create or replace function private.sync_peek_request_supporter_count()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    update public.peek_requests
    set supporter_count = supporter_count + 1, updated_at = now()
    where id = new.request_id;
    return new;
  end if;

  update public.peek_requests
  set supporter_count = greatest(supporter_count - 1, 0), updated_at = now()
  where id = old.request_id;
  return old;
end;
$function$;

drop trigger if exists trg_peek_request_supporters_count on public.peek_request_supporters;
create trigger trg_peek_request_supporters_count
  after insert or delete on public.peek_request_supporters
  for each row execute function private.sync_peek_request_supporter_count();

create or replace function private.touch_peek_request()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_peek_requests_updated_at on public.peek_requests;
create trigger trg_peek_requests_updated_at
  before update on public.peek_requests
  for each row execute function private.touch_peek_request();

-- 7. Slot guard ------------------------------------------------------------
-- A Response Peek must never be promoted into the Main Listing Peek slot.
-- Enforced at the table rather than inside publish_listing_tour, so a future
-- code path cannot route around it.

create or replace function private.reject_response_peek_in_slot()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.current_tour_id is not null
     and exists (
       select 1 from public.listing_tours t
       where t.id = new.current_tour_id and t.peek_kind = 'response'
     ) then
    raise exception 'a response Peek cannot occupy the Main Listing Peek slot'
      using errcode = '22023';
  end if;

  if new.pending_tour_id is not null
     and exists (
       select 1 from public.listing_tours t
       where t.id = new.pending_tour_id and t.peek_kind = 'response'
     ) then
    raise exception 'a response Peek cannot be staged as the Main Listing Peek'
      using errcode = '22023';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_listing_tour_slots_reject_response on public.listing_tour_slots;
create trigger trg_listing_tour_slots_reject_response
  before insert or update of current_tour_id, pending_tour_id
  on public.listing_tour_slots
  for each row execute function private.reject_response_peek_in_slot();

-- 8. Indexes ---------------------------------------------------------------
-- Each one backs a query the feature actually issues; none is speculative.

-- Thread listing for a parent, newest first (keyset pagination).
create index if not exists idx_peek_requests_listing_recent
  on public.peek_requests (listing_id, created_at desc, id desc)
  where listing_id is not null;

create index if not exists idx_peek_requests_service_recent
  on public.peek_requests (service_id, created_at desc, id desc)
  where service_id is not null;

-- "Most Wanted" ordering.
create index if not exists idx_peek_requests_listing_demand
  on public.peek_requests (listing_id, supporter_count desc, created_at desc)
  where listing_id is not null and status = 'pending';

-- Seller dashboard queue: the seller's pending requests across their listings.
create index if not exists idx_peek_requests_status_created
  on public.peek_requests (status, created_at desc);

-- Duplicate detection before creating a request.
create index if not exists idx_peek_requests_listing_category
  on public.peek_requests (listing_id, category)
  where listing_id is not null and status in ('pending', 'answered');

-- Notification fan-out reads supporters by request.
create index if not exists idx_peek_request_supporters_user
  on public.peek_request_supporters (user_id, created_at desc);

create index if not exists idx_peek_request_responses_tour
  on public.peek_request_responses (tour_id);

-- Response Peeks for a listing, excluding the Main Peek.
create index if not exists idx_listing_tours_response_kind
  on public.listing_tours (listing_id, peek_kind, published_at desc)
  where peek_kind = 'response';

-- 9. Row level security ----------------------------------------------------

alter table public.peek_requests enable row level security;
alter table public.peek_request_supporters enable row level security;
alter table public.peek_request_responses enable row level security;

-- Requests are public, but only approved ones on a publicly visible parent.
drop policy if exists peek_requests_public_read on public.peek_requests;
create policy peek_requests_public_read
  on public.peek_requests
  for select
  using (
    moderation_status = 'approved'
    and status <> 'removed'
    and (
      (listing_id is not null and exists (
        select 1 from public.listings l
        where l.id = peek_requests.listing_id
          and l.status in ('available', 'under_offer')
          and l.content_suspended_at is null
      ))
      or (service_id is not null and exists (
        select 1 from public.services s
        where s.id = peek_requests.service_id
          and s.status = 'active'
          and s.category <> 'legal'
      ))
    )
  );

-- A requester always sees their own, and the parent owner and admins see all,
-- including those still awaiting moderation.
drop policy if exists peek_requests_participant_read on public.peek_requests;
create policy peek_requests_participant_read
  on public.peek_requests
  for select
  using (
    requester_id = auth.uid()
    or public.is_admin()
    or (listing_id is not null and exists (
      select 1 from public.listings l
      where l.id = peek_requests.listing_id and l.seller_id = auth.uid()
    ))
    or (service_id is not null and exists (
      select 1 from public.services s
      where s.id = peek_requests.service_id and s.provider_id = auth.uid()
    ))
  );

-- Creation: identity is forced to the caller and the request starts in a
-- neutral state. A client cannot pre-set status, counters, moderation or the
-- answering Peek.
drop policy if exists peek_requests_create on public.peek_requests;
create policy peek_requests_create
  on public.peek_requests
  for insert
  with check (
    public.is_active_user()
    and requester_id = auth.uid()
    and status = 'pending'
    and moderation_status = 'pending'
    and supporter_count = 0
    and current_response_id is null
    and merged_into_id is null
    and answered_at is null
    and declined_at is null
    -- A seller cannot manufacture demand on their own listing.
    and (listing_id is null or not exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    ))
    and (service_id is null or not exists (
      select 1 from public.services s
      where s.id = service_id and s.provider_id = auth.uid()
    ))
  );

-- Only admins update requests directly. Owners answer and decline through
-- SECURITY DEFINER RPCs in phase 4, so the state machine lives in one place
-- rather than being reconstructable from a client payload.
drop policy if exists peek_requests_admin_update on public.peek_requests;
create policy peek_requests_admin_update
  on public.peek_requests
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Supporters read their own support, so the UI can show "you want this too".
drop policy if exists peek_request_supporters_own_read on public.peek_request_supporters;
create policy peek_request_supporters_own_read
  on public.peek_request_supporters
  for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists peek_request_supporters_create on public.peek_request_supporters;
create policy peek_request_supporters_create
  on public.peek_request_supporters
  for insert
  with check (
    public.is_active_user()
    and user_id = auth.uid()
    and exists (
      select 1 from public.peek_requests r
      where r.id = request_id
        and r.status = 'pending'
        and r.moderation_status = 'approved'
        -- Supporting your own request would be self-inflation.
        and r.requester_id <> auth.uid()
    )
  );

drop policy if exists peek_request_supporters_withdraw on public.peek_request_supporters;
create policy peek_request_supporters_withdraw
  on public.peek_request_supporters
  for delete
  using (user_id = auth.uid());

-- Response bindings are readable wherever their request is readable.
drop policy if exists peek_request_responses_read on public.peek_request_responses;
create policy peek_request_responses_read
  on public.peek_request_responses
  for select
  using (exists (select 1 from public.peek_requests r where r.id = request_id));

-- 10. Grants ---------------------------------------------------------------
-- Explicit column allowlist for anon, matching the pattern established in
-- 0109/0111. requester_id is deliberately withheld: the brief requires that a
-- request be public while the buyer behind it is not.

revoke all on public.peek_requests from anon, authenticated;
revoke all on public.peek_request_supporters from anon, authenticated;
revoke all on public.peek_request_responses from anon, authenticated;

grant select (
  id, listing_id, service_id, category, body, status, merged_into_id,
  supporter_count, current_response_id, answered_at, declined_at,
  created_at, updated_at
) on public.peek_requests to anon;

grant select on public.peek_requests to authenticated;
grant insert on public.peek_requests to authenticated;

grant select, insert, delete on public.peek_request_supporters to authenticated;

grant select on public.peek_request_responses to anon, authenticated;

-- Consistent with 0110: no RLS-bypassing privilege reaches a browser role.
revoke truncate, trigger, references on public.peek_requests from anon, authenticated;
revoke truncate, trigger, references on public.peek_request_supporters from anon, authenticated;
revoke truncate, trigger, references on public.peek_request_responses from anon, authenticated;
