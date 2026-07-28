-- 0018_v1_messaging.sql
-- Minimal V1 listing-linked buyer/seller messaging. Messages are plain text;
-- there are no attachments, receipts, presence, typing, reactions or groups.

create table public.conversations (
  id                       uuid primary key default gen_random_uuid(),
  listing_id               uuid not null references public.listings(id) on delete cascade,
  buyer_id                 uuid not null references public.users(id),
  seller_id                uuid not null references public.users(id),
  state                    text not null default 'open' check (state in ('open', 'closed')),
  last_message_at          timestamptz,
  last_message_sender_id   uuid references public.users(id),
  buyer_last_seen_at       timestamptz,
  seller_last_seen_at      timestamptz,
  buyer_blocked_at         timestamptz,
  seller_blocked_at        timestamptz,
  retention_until          timestamptz not null default (now() + interval '24 months'),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint conversations_distinct_participants check (buyer_id <> seller_id),
  constraint conversations_one_buyer_per_listing unique (listing_id, buyer_id)
);

create index conversations_buyer_inbox
  on public.conversations(buyer_id, last_message_at desc, id desc);
create index conversations_seller_inbox
  on public.conversations(seller_id, last_message_at desc, id desc);

create trigger trg_conversations_updated_at
  before update on public.conversations
  for each row execute function set_updated_at();

do $$
begin
  if exists (
    select 1
      from public.inquiries i
      join public.listings l on l.id = i.listing_id
     where i.seller_id <> l.seller_id or i.buyer_id = i.seller_id
  ) then
    raise exception 'messaging migration requires participant reconciliation';
  end if;

  if exists (
    select 1
      from public.inquiries
     group by conversation_id
    having count(distinct listing_id::text || ':' || buyer_id::text || ':' || seller_id::text) > 1
  ) then
    raise exception 'messaging migration requires conversation-id reconciliation';
  end if;
end;
$$;

insert into public.conversations (
  id, listing_id, buyer_id, seller_id, last_message_at,
  last_message_sender_id, created_at, updated_at
)
select distinct on (i.listing_id, i.buyer_id)
  i.conversation_id,
  i.listing_id,
  i.buyer_id,
  i.seller_id,
  latest.created_at,
  latest.sender_id,
  first_value(i.created_at) over (
    partition by i.listing_id, i.buyer_id order by i.created_at, i.id
  ),
  latest.created_at
from public.inquiries i
join lateral (
  select newest.created_at, newest.sender_id
    from public.inquiries newest
   where newest.listing_id = i.listing_id
     and newest.buyer_id = i.buyer_id
   order by newest.created_at desc, newest.id desc
   limit 1
) latest on true
order by i.listing_id, i.buyer_id, i.created_at, i.id;

update public.inquiries i
   set conversation_id = c.id
  from public.conversations c
 where c.listing_id = i.listing_id
   and c.buyer_id = i.buyer_id;

alter table public.inquiries alter column conversation_id drop default;
alter table public.inquiries
  add constraint inquiries_conversation_fk
  foreign key (conversation_id) references public.conversations(id) on delete cascade,
  add constraint inquiries_v1_message_length
  check (char_length(btrim(message)) between 1 and 2000) not valid,
  add constraint inquiries_v1_no_attachments
  check (attachments = '[]'::jsonb) not valid,
  add constraint inquiries_v1_no_receipts
  check (delivered_at is null and read_at is null) not valid;

create table public.conversation_reports (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  reporter_id      uuid not null references public.users(id),
  reason           text not null check (reason in ('spam', 'scam', 'harassment', 'unsafe', 'other')),
  description      text,
  status           report_status not null default 'pending',
  admin_notes      text,
  reviewed_by      uuid references public.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (conversation_id, reporter_id),
  check (description is null or char_length(description) <= 500)
);

create index conversation_reports_status
  on public.conversation_reports(status, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_reports enable row level security;

create policy "conversations_participant_read" on public.conversations
  for select using (
    public.is_active_user()
    and (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin())
  );

create policy "conversation_reports_reporter_or_admin_read" on public.conversation_reports
  for select using (
    public.is_active_user()
    and (reporter_id = auth.uid() or public.is_admin())
  );

drop policy if exists "inquiries_participants" on public.inquiries;
drop policy if exists "inquiries_create" on public.inquiries;
create policy "inquiries_participant_read" on public.inquiries
  for select using (
    public.is_active_user()
    and exists (
      select 1 from public.conversations c
       where c.id = inquiries.conversation_id
         and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.normalize_message_body(value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text := btrim(coalesce(value, ''));
begin
  if char_length(normalized) < 1 or char_length(normalized) > 2000 then
    raise exception 'message must contain between 1 and 2000 characters'
      using errcode = '22023';
  end if;
  if regexp_replace(normalized, E'[\n\r\t]', '', 'g') ~ '[[:cntrl:]]' then
    raise exception 'message contains unsupported control characters'
      using errcode = '22023';
  end if;
  return normalized;
end;
$$;

create or replace function public.assert_message_rate_limit()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.inquiries
     where sender_id = auth.uid() and created_at >= now() - interval '1 minute'
  ) >= 10 then
    raise exception 'message rate limit exceeded; try again shortly'
      using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.inquiries
     where sender_id = auth.uid() and created_at >= now() - interval '24 hours'
  ) >= 200 then
    raise exception 'daily message rate limit exceeded'
      using errcode = 'P0001';
  end if;
end;
$$;

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

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;
  listing_row public.listings%rowtype;
  body text := public.normalize_message_body(p_message);
  buyer_name text;
  message_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into conversation_row from public.conversations
   where id = p_conversation_id
     and (buyer_id = auth.uid() or seller_id = auth.uid())
   for update;
  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  if conversation_row.state <> 'open'
    or conversation_row.buyer_blocked_at is not null
    or conversation_row.seller_blocked_at is not null
    or conversation_row.retention_until <= now()
  then
    raise exception 'conversation is unavailable' using errcode = '42501';
  end if;

  select * into listing_row from public.listings where id = conversation_row.listing_id;
  if not found then
    raise exception 'listing context is unavailable' using errcode = 'P0002';
  end if;
  select full_name into buyer_name from public.users where id = conversation_row.buyer_id;

  perform public.assert_message_rate_limit();
  insert into public.inquiries (
    listing_id, listing_title, seller_id, buyer_id, buyer_name,
    message, sender_id, conversation_id, status, attachments
  ) values (
    listing_row.id, listing_row.title, conversation_row.seller_id,
    conversation_row.buyer_id, buyer_name, body, auth.uid(),
    conversation_row.id, 'new', '[]'::jsonb
  ) returning id into message_id;

  update public.conversations
     set last_message_at = now(), last_message_sender_id = auth.uid(),
         buyer_last_seen_at = case when buyer_id = auth.uid() then now() else buyer_last_seen_at end,
         seller_last_seen_at = case when seller_id = auth.uid() then now() else seller_last_seen_at end
   where id = conversation_row.id;
  return message_id;
end;
$$;

create or replace function public.message_inbox(
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

create or replace function public.message_thread_rows(
  p_conversation_id uuid,
  p_limit integer default 200
)
returns table (
  message_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() or p_limit < 1 or p_limit > 200 then
    raise exception 'invalid thread request' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.conversations c
     where c.id = p_conversation_id
       and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  ) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;

  return query
  select recent.id, recent.sender_id, recent.message, recent.created_at
  from (
    select i.id, i.sender_id, i.message, i.created_at
      from public.inquiries i
     where i.conversation_id = p_conversation_id
     order by i.created_at desc, i.id desc
     limit p_limit
  ) recent
  order by recent.created_at, recent.id;
end;
$$;

create or replace function public.mark_conversation_seen(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  update public.conversations
     set buyer_last_seen_at = case when buyer_id = auth.uid() then now() else buyer_last_seen_at end,
         seller_last_seen_at = case when seller_id = auth.uid() then now() else seller_last_seen_at end
   where id = p_conversation_id
     and (buyer_id = auth.uid() or seller_id = auth.uid());
  if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.set_conversation_block(
  p_conversation_id uuid,
  p_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  update public.conversations
     set buyer_blocked_at = case when buyer_id = auth.uid() then case when p_blocked then now() else null end else buyer_blocked_at end,
         seller_blocked_at = case when seller_id = auth.uid() then case when p_blocked then now() else null end else seller_blocked_at end
   where id = p_conversation_id
     and (buyer_id = auth.uid() or seller_id = auth.uid());
  if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.report_conversation(
  p_conversation_id uuid,
  p_reason text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare report_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_reason not in ('spam', 'scam', 'harassment', 'unsafe', 'other')
    or char_length(coalesce(p_description, '')) > 500
  then
    raise exception 'invalid conversation report' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.conversations c
     where c.id = p_conversation_id
       and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  ) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reports (conversation_id, reporter_id, reason, description)
  values (p_conversation_id, auth.uid(), p_reason, nullif(btrim(coalesce(p_description, '')), ''))
  on conflict (conversation_id, reporter_id) do update
    set reason = excluded.reason, description = excluded.description,
        status = 'pending', admin_notes = null, reviewed_by = null, reviewed_at = null,
        created_at = now()
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.normalize_message_body(text) from public;
revoke all on function public.assert_message_rate_limit() from public;
revoke all on function public.start_listing_conversation(uuid, text) from public;
revoke all on function public.send_conversation_message(uuid, text) from public;
revoke all on function public.message_inbox(text, boolean, integer, integer) from public;
revoke all on function public.message_conversation(uuid) from public;
revoke all on function public.message_thread_rows(uuid, integer) from public;
revoke all on function public.mark_conversation_seen(uuid) from public;
revoke all on function public.set_conversation_block(uuid, boolean) from public;
revoke all on function public.report_conversation(uuid, text, text) from public;

grant execute on function public.start_listing_conversation(uuid, text) to authenticated;
grant execute on function public.send_conversation_message(uuid, text) to authenticated;
grant execute on function public.message_inbox(text, boolean, integer, integer) to authenticated;
grant execute on function public.message_conversation(uuid) to authenticated;
grant execute on function public.message_thread_rows(uuid, integer) to authenticated;
grant execute on function public.mark_conversation_seen(uuid) to authenticated;
grant execute on function public.set_conversation_block(uuid, boolean) to authenticated;
grant execute on function public.report_conversation(uuid, text, text) to authenticated;

-- Include conversation abuse reports in the existing small founder workflow.
create or replace function public.admin_dashboard_stats()
returns jsonb as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'active_listings', (select count(*) from public.listings where status in ('available', 'under_offer', 'rented')),
    'active_services', (select count(*) from public.services where status = 'active' and category <> 'legal'),
    'total_users', (select count(*) from public.users),
    'pending_reports', (
      (select count(*) from public.reports where status = 'pending')
      + (select count(*) from public.conversation_reports where status = 'pending')
    ),
    'new_users_today', (select count(*) from public.users where created_at >= current_date),
    'new_marketplace_today', (
      (select count(*) from public.listings where created_at >= current_date)
      + (select count(*) from public.services where created_at >= current_date and category <> 'legal')
    )
  );
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_report_rows(
  p_query text default '',
  p_status text default 'pending',
  p_kind text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  report_id uuid,
  listing_id uuid,
  listing_type text,
  listing_title text,
  reason text,
  description text,
  reporter_id uuid,
  reporter_email text,
  status text,
  admin_notes text,
  reviewed_by uuid,
  reviewer_email text,
  reviewed_at timestamptz,
  created_at timestamptz,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_status not in ('all', 'pending', 'reviewed', 'dismissed', 'actioned')
    or p_kind not in ('all', 'property', 'vehicle', 'machinery', 'service', 'message')
  then
    raise exception 'invalid report filter' using errcode = '22023';
  end if;

  return query
  with combined as (
    select
      r.id, r.listing_id, r.listing_type::text as item_type, r.listing_title,
      r.reason::text as reason, r.description, r.reporter_id,
      reporter.email as reporter_email, r.status::text as status, r.admin_notes,
      r.reviewed_by, reviewer.email as reviewer_email, r.reviewed_at, r.created_at
    from public.reports r
    join public.users reporter on reporter.id = r.reporter_id
    left join public.users reviewer on reviewer.id = r.reviewed_by
    union all
    select
      cr.id, null::uuid, 'message', 'Conversation about ' || l.title,
      cr.reason, cr.description, cr.reporter_id,
      reporter.email, cr.status::text, cr.admin_notes,
      cr.reviewed_by, reviewer.email, cr.reviewed_at, cr.created_at
    from public.conversation_reports cr
    join public.conversations c on c.id = cr.conversation_id
    join public.listings l on l.id = c.listing_id
    join public.users reporter on reporter.id = cr.reporter_id
    left join public.users reviewer on reviewer.id = cr.reviewed_by
  ), filtered as (
    select * from combined
    where (p_status = 'all' or combined.status = p_status)
      and (p_kind = 'all' or combined.item_type = p_kind)
      and (
        trim(coalesce(p_query, '')) = ''
        or combined.listing_title ilike '%' || trim(p_query) || '%'
        or combined.reporter_email ilike '%' || trim(p_query) || '%'
        or combined.reason ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.id, filtered.listing_id, filtered.item_type,
    filtered.listing_title, filtered.reason, filtered.description,
    filtered.reporter_id, filtered.reporter_email, filtered.status,
    filtered.admin_notes, filtered.reviewed_by, filtered.reviewer_email,
    filtered.reviewed_at, filtered.created_at, count(*) over()
  from filtered
  order by filtered.created_at desc, filtered.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_review_report(
  p_report_id uuid,
  p_status report_status,
  p_notes text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_notes);
  before_row jsonb;
  after_row jsonb;
  target_listing uuid;
  target_conversation uuid;
begin
  if p_status not in ('reviewed', 'dismissed', 'actioned') then
    raise exception 'invalid report decision' using errcode = '22023';
  end if;

  select to_jsonb(r), r.listing_id into before_row, target_listing
  from public.reports r where r.id = p_report_id for update;

  if before_row is not null then
    if p_status = 'actioned' then
      if target_listing is null then
        raise exception 'reported listing is no longer available' using errcode = 'P0002';
      end if;
      update public.reports
      set status = 'actioned', admin_notes = normalized_reason,
          reviewed_by = auth.uid(), reviewed_at = now()
      where listing_id = target_listing and status in ('pending', 'reviewed');
      update public.reports set listing_id = null where listing_id = target_listing;
      delete from public.listings where id = target_listing;
    else
      update public.reports
      set status = p_status, admin_notes = normalized_reason,
          reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_report_id;
    end if;
    select to_jsonb(r) into after_row from public.reports r where r.id = p_report_id;
    perform public.record_admin_action(
      'report.' || p_status::text, p_report_id::text, 'report',
      normalized_reason, before_row, after_row
    );
    return after_row;
  end if;

  select to_jsonb(cr), cr.conversation_id into before_row, target_conversation
  from public.conversation_reports cr where cr.id = p_report_id for update;
  if before_row is null then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  update public.conversation_reports
     set status = p_status, admin_notes = normalized_reason,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report_id;
  if p_status = 'actioned' then
    update public.conversations set state = 'closed' where id = target_conversation;
  end if;
  select to_jsonb(cr) into after_row
    from public.conversation_reports cr where cr.id = p_report_id;
  perform public.record_admin_action(
    'conversation_report.' || p_status::text, p_report_id::text,
    'conversation_report', normalized_reason, before_row, after_row
  );
  return after_row;
end;
$$ language plpgsql security definer set search_path = public;

comment on table public.conversations is
  'V1 listing-linked buyer/seller conversations; no group or presence semantics.';
comment on table public.inquiries is
  'Legacy-compatible table used as immutable V1 plain-text message rows.';
