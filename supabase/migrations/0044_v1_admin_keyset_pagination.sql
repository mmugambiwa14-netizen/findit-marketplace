-- Milestone: founder administration keyset pagination.
-- Replaces deep offsets and exact totals on high-volume admin queues while
-- preserving the legacy RPCs for rollback and older deployed clients.

create index if not exists idx_listings_admin_cursor
  on public.listings(kind, status, created_at desc, id desc);
create index if not exists idx_services_admin_cursor
  on public.services(status, created_at desc, id desc)
  where category <> 'legal';
create index if not exists idx_users_admin_cursor
  on public.users(role, status, created_at desc, id desc);
create index if not exists idx_reports_admin_cursor
  on public.reports(status, created_at desc, id desc);
create index if not exists idx_conversation_reports_admin_cursor
  on public.conversation_reports(status, created_at desc, id desc);
create index if not exists idx_audit_logs_admin_cursor
  on public.audit_logs(target_record_type, created_at desc, id desc);
create index if not exists idx_support_requests_admin_cursor
  on public.support_requests(status, category, created_at desc, id desc);
create index if not exists idx_listing_tours_admin_cursor
  on public.listing_tours(moderation_status, status, (coalesce(ready_at, created_at)) desc, id desc)
  where deleted_at is null;

create or replace function public.admin_marketplace_rows_page(
  p_query text default '',
  p_kind text default 'all',
  p_status text default 'all',
  p_limit integer default 25,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  item_id uuid,
  item_kind text,
  title text,
  price numeric,
  currency text,
  status text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  category text,
  created_at timestamptz,
  report_count bigint
) as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_kind not in ('all', 'property', 'car', 'machinery', 'service')
    or p_limit not between 1 and 100
    or length(normalized_query) > 100
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid marketplace page' using errcode = '22023';
  end if;
  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  with marketplace as (
    select
      l.id as item_id, l.kind::text as item_kind, l.title, l.price, l.currency,
      l.status::text as status, l.seller_id as owner_id,
      coalesce(l.seller_name, u.full_name) as owner_name, u.email as owner_email,
      l.category, l.created_at,
      (select count(*) from public.reports r where r.listing_id = l.id) as report_count
    from public.listings l
    join public.users u on u.id = l.seller_id
    union all
    select
      s.id, 'service'::text, s.title, s.price, s.currency, s.status::text,
      s.provider_id, coalesce(s.provider_name, u.full_name), u.email,
      s.category::text, s.created_at, 0::bigint
    from public.services s
    join public.users u on u.id = s.provider_id
    where s.category <> 'legal'
  ), filtered as (
    select m.* from marketplace m
    where (p_kind = 'all' or m.item_kind = p_kind)
      and (p_status = 'all' or m.status = p_status)
      and (
        normalized_query = ''
        or m.title ilike '%' || escaped_query || '%' escape E'\\'
        or coalesce(m.owner_name, '') ilike '%' || escaped_query || '%' escape E'\\'
        or m.owner_email ilike '%' || escaped_query || '%' escape E'\\'
      )
      and (p_cursor_at is null or (m.created_at, m.item_id) < (p_cursor_at, p_cursor_id))
  )
  select f.item_id, f.item_kind, f.title, f.price, f.currency, f.status,
    f.owner_id, f.owner_name, f.owner_email, f.category, f.created_at, f.report_count
  from filtered f
  order by f.created_at desc, f.item_id desc
  limit p_limit + 1;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_user_rows_page(
  p_query text default '',
  p_role text default 'all',
  p_status text default 'all',
  p_limit integer default 25,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  phone_verified boolean,
  role text,
  status text,
  super_admin boolean,
  ban_reason text,
  ban_until timestamptz,
  created_at timestamptz,
  listing_count bigint,
  service_count bigint
) as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if p_role not in ('all', 'user', 'admin')
    or p_status not in ('all', 'active', 'suspended', 'banned')
    or p_limit not between 1 and 100
    or length(normalized_query) > 100
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then raise exception 'invalid user page' using errcode = '22023'; end if;
  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  select
    u.id, u.email, u.full_name, u.phone, u.phone_verified, u.role,
    u.status::text, u.super_admin, u.ban_reason, u.ban_until, u.created_at,
    (select count(*) from public.listings l where l.seller_id = u.id),
    (select count(*) from public.services s where s.provider_id = u.id and s.category <> 'legal')
  from public.users u
  where (p_role = 'all' or u.role = p_role)
    and (p_status = 'all' or u.status::text = p_status)
    and (
      normalized_query = ''
      or u.email ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(u.full_name, '') ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (p_cursor_at is null or (u.created_at, u.id) < (p_cursor_at, p_cursor_id))
  order by u.created_at desc, u.id desc
  limit p_limit + 1;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_report_rows_page(
  p_query text default '',
  p_status text default 'pending',
  p_kind text default 'all',
  p_limit integer default 25,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  listing_id uuid,
  service_id uuid,
  tour_id uuid,
  listing_type text,
  listing_title text,
  reason text,
  description text,
  reporter_id uuid,
  reporter_email text,
  reporter_tour_reports_24h bigint,
  status text,
  admin_notes text,
  reviewed_by uuid,
  reviewer_email text,
  reviewed_at timestamptz,
  tour_status text,
  tour_moderation_status text,
  created_at timestamptz
) as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if p_status not in ('all', 'pending', 'reviewed', 'dismissed', 'actioned')
    or p_kind not in ('all', 'property', 'vehicle', 'machinery', 'service', 'tour', 'message')
    or p_limit not between 1 and 100
    or length(normalized_query) > 100
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then raise exception 'invalid report page' using errcode = '22023'; end if;
  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  with combined as (
    select
      r.id, r.target_type, r.target_id, r.listing_id, r.service_id, r.tour_id,
      case when r.target_type = 'tour' then 'tour' else r.listing_type::text end as item_type,
      r.listing_type::text as listing_type, r.listing_title,
      coalesce(r.tour_reason, r.reason::text) as reason, r.description,
      r.reporter_id, reporter.email as reporter_email,
      (select count(*) from public.reports rr where rr.reporter_id = r.reporter_id and rr.target_type = 'tour' and rr.created_at >= now() - interval '24 hours') as reporter_tour_reports_24h,
      r.status::text as status, r.admin_notes, r.reviewed_by,
      reviewer.email as reviewer_email, r.reviewed_at,
      t.status as tour_status, t.moderation_status as tour_moderation_status,
      r.created_at
    from public.reports r
    join public.users reporter on reporter.id = r.reporter_id
    left join public.users reviewer on reviewer.id = r.reviewed_by
    left join public.listing_tours t on t.id = r.tour_id
    union all
    select
      cr.id, 'message'::text, cr.conversation_id, null::uuid, null::uuid, null::uuid,
      'message'::text, 'message'::text, 'Conversation about ' || l.title,
      cr.reason, cr.description, cr.reporter_id, reporter.email, 0::bigint,
      cr.status::text, cr.admin_notes, cr.reviewed_by, reviewer.email,
      cr.reviewed_at, null::text, null::text, cr.created_at
    from public.conversation_reports cr
    join public.conversations c on c.id = cr.conversation_id
    join public.listings l on l.id = c.listing_id
    join public.users reporter on reporter.id = cr.reporter_id
    left join public.users reviewer on reviewer.id = cr.reviewed_by
  ), filtered as (
    select c.* from combined c
    where (p_status = 'all' or c.status = p_status)
      and (p_kind = 'all' or c.item_type = p_kind)
      and (
        normalized_query = ''
        or coalesce(c.listing_title, '') ilike '%' || escaped_query || '%' escape E'\\'
        or c.reporter_email ilike '%' || escaped_query || '%' escape E'\\'
        or c.reason ilike '%' || escaped_query || '%' escape E'\\'
      )
      and (p_cursor_at is null or (c.created_at, c.id) < (p_cursor_at, p_cursor_id))
  )
  select f.id, f.target_type, f.target_id, f.listing_id, f.service_id, f.tour_id,
    f.listing_type, f.listing_title, f.reason, f.description, f.reporter_id,
    f.reporter_email, f.reporter_tour_reports_24h, f.status, f.admin_notes,
    f.reviewed_by, f.reviewer_email, f.reviewed_at, f.tour_status,
    f.tour_moderation_status, f.created_at
  from filtered f
  order by f.created_at desc, f.id desc
  limit p_limit + 1;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_support_request_rows_page(
  p_query text default '',
  p_status text default 'open',
  p_category text default 'all',
  p_limit integer default 25,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  request_id uuid,
  reference_id text,
  user_id uuid,
  contact_email text,
  category text,
  message text,
  related_reference text,
  status text,
  admin_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz
) as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if p_status not in ('all', 'open', 'resolved')
    or p_category not in ('all', 'account', 'listing', 'report', 'safety', 'technical', 'other')
    or p_limit not between 1 and 100
    or length(normalized_query) > 100
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then raise exception 'invalid support page' using errcode = '22023'; end if;
  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  select sr.id, sr.reference_id, sr.user_id, sr.contact_email, sr.category,
    sr.message, sr.related_reference, sr.status, sr.admin_note, sr.resolved_by,
    sr.resolved_at, sr.created_at
  from public.support_requests sr
  where (p_status = 'all' or sr.status = p_status)
    and (p_category = 'all' or sr.category = p_category)
    and (
      normalized_query = ''
      or sr.reference_id ilike '%' || escaped_query || '%' escape E'\\'
      or sr.contact_email ilike '%' || escaped_query || '%' escape E'\\'
      or sr.message ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(sr.related_reference, '') ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (p_cursor_at is null or (sr.created_at, sr.id) < (p_cursor_at, p_cursor_id))
  order by sr.created_at desc, sr.id desc
  limit p_limit + 1;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_audit_rows_page(
  p_query text default '',
  p_target_type text default 'all',
  p_limit integer default 50,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  audit_id uuid,
  admin_user_id uuid,
  admin_email text,
  action_performed text,
  target_record_id text,
  target_record_type text,
  reason text,
  result text,
  correlation_id uuid,
  created_at timestamptz
) as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if p_limit not between 1 and 100
    or length(normalized_query) > 100
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then raise exception 'invalid audit page' using errcode = '22023'; end if;
  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  select a.id, a.admin_user_id, u.email, a.action_performed,
    a.target_record_id, a.target_record_type, a.reason, a.result,
    a.correlation_id, a.created_at
  from public.audit_logs a
  join public.users u on u.id = a.admin_user_id
  where (p_target_type = 'all' or a.target_record_type = p_target_type)
    and (
      normalized_query = ''
      or u.email ilike '%' || escaped_query || '%' escape E'\\'
      or a.action_performed ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(a.reason, '') ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (p_cursor_at is null or (a.created_at, a.id) < (p_cursor_at, p_cursor_id))
  order by a.created_at desc, a.id desc
  limit p_limit + 1;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_tour_queue_page(
  p_query text default '',
  p_status text default 'pending',
  p_limit integer default 25,
  p_cursor_reported_priority integer default null,
  p_cursor_failed_priority integer default null,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  parent_title text,
  parent_status text,
  parent_path text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  owner_status text,
  owner_rejected_tour_count bigint,
  status text,
  moderation_status text,
  duration_seconds numeric,
  failure_code text,
  failure_message text,
  rejection_reason text,
  report_count bigint,
  latest_report_id uuid,
  latest_report_reason text,
  ready_at timestamptz,
  created_at timestamptz,
  reported_priority integer,
  failed_priority integer,
  sort_at timestamptz
) as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
  cursor_parts integer := num_nonnulls(p_cursor_reported_priority, p_cursor_failed_priority, p_cursor_at, p_cursor_id);
begin
  if not public.is_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if p_status not in ('all', 'pending', 'approved', 'rejected', 'reported', 'failed')
    or p_limit not between 1 and 100
    or length(normalized_query) > 100
    or cursor_parts not in (0, 4)
    or (cursor_parts = 4 and (p_cursor_reported_priority not in (0, 1) or p_cursor_failed_priority not in (0, 1)))
  then raise exception 'invalid Tour queue page' using errcode = '22023'; end if;
  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  with queue as (
    select
      t.id as tour_id,
      case when t.listing_id is not null then 'listing' else 'service' end as parent_type,
      coalesce(t.listing_id, t.service_id) as parent_id,
      coalesce(l.title, s.title) as parent_title,
      coalesce(l.status::text, s.status::text) as parent_status,
      case when t.service_id is not null then '/service/' || t.service_id::text else '/' || l.kind::text || '/' || t.listing_id::text end as parent_path,
      t.owner_id, u.full_name as owner_name, u.email as owner_email,
      u.status::text as owner_status,
      (select count(*) from public.listing_tours rejected where rejected.owner_id = t.owner_id and rejected.id <> t.id and rejected.moderation_status = 'rejected') as owner_rejected_tour_count,
      t.status, t.moderation_status, t.duration_seconds, t.failure_code,
      t.failure_message, t.rejection_reason,
      (select count(*) from public.reports r where r.tour_id = t.id) as report_count,
      (select r.id from public.reports r where r.tour_id = t.id and r.status in ('pending', 'reviewed') order by r.created_at desc, r.id desc limit 1) as latest_report_id,
      (select r.tour_reason from public.reports r where r.tour_id = t.id order by r.created_at desc, r.id desc limit 1) as latest_report_reason,
      t.ready_at, t.created_at,
      case when t.moderation_status = 'reported' then 0 else 1 end as reported_priority,
      case when t.status = 'failed' then 0 else 1 end as failed_priority,
      coalesce(t.ready_at, t.created_at) as sort_at
    from public.listing_tours t
    join public.users u on u.id = t.owner_id
    left join public.listings l on l.id = t.listing_id
    left join public.services s on s.id = t.service_id
    where t.deleted_at is null
      and (
        p_status = 'all'
        or (p_status = 'failed' and t.status = 'failed')
        or (p_status <> 'failed' and t.moderation_status = p_status)
      )
  ), filtered as (
    select q.* from queue q
    where (
      normalized_query = ''
      or coalesce(q.parent_title, '') ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(q.owner_name, '') ilike '%' || escaped_query || '%' escape E'\\'
      or q.owner_email ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(q.latest_report_reason, '') ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(q.failure_code, '') ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (
      cursor_parts = 0
      or q.reported_priority > p_cursor_reported_priority
      or (q.reported_priority = p_cursor_reported_priority and q.failed_priority > p_cursor_failed_priority)
      or (q.reported_priority = p_cursor_reported_priority and q.failed_priority = p_cursor_failed_priority and q.sort_at < p_cursor_at)
      or (q.reported_priority = p_cursor_reported_priority and q.failed_priority = p_cursor_failed_priority and q.sort_at = p_cursor_at and q.tour_id < p_cursor_id)
    )
  )
  select f.tour_id, f.parent_type, f.parent_id, f.parent_title, f.parent_status,
    f.parent_path, f.owner_id, f.owner_name, f.owner_email, f.owner_status,
    f.owner_rejected_tour_count, f.status, f.moderation_status, f.duration_seconds,
    f.failure_code, f.failure_message, f.rejection_reason, f.report_count,
    f.latest_report_id, f.latest_report_reason, f.ready_at, f.created_at,
    f.reported_priority, f.failed_priority, f.sort_at
  from filtered f
  order by f.reported_priority, f.failed_priority, f.sort_at desc, f.tour_id desc
  limit p_limit + 1;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke all on function public.admin_marketplace_rows_page(text, text, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.admin_user_rows_page(text, text, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.admin_report_rows_page(text, text, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.admin_support_request_rows_page(text, text, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.admin_audit_rows_page(text, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.admin_tour_queue_page(text, text, integer, integer, integer, timestamptz, uuid) from public, anon;

grant execute on function public.admin_marketplace_rows_page(text, text, text, integer, timestamptz, uuid) to authenticated;
grant execute on function public.admin_user_rows_page(text, text, text, integer, timestamptz, uuid) to authenticated;
grant execute on function public.admin_report_rows_page(text, text, text, integer, timestamptz, uuid) to authenticated;
grant execute on function public.admin_support_request_rows_page(text, text, text, integer, timestamptz, uuid) to authenticated;
grant execute on function public.admin_audit_rows_page(text, text, integer, timestamptz, uuid) to authenticated;
grant execute on function public.admin_tour_queue_page(text, text, integer, integer, integer, timestamptz, uuid) to authenticated;
