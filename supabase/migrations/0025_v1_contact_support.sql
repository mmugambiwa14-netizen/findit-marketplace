-- 0025_v1_contact_support.sql
-- Minimal V1 founder inbox. This deliberately does not activate the legacy
-- support ticket/chat/agent system retained in migration 0009.

create table public.support_requests (
  id              uuid primary key default gen_random_uuid(),
  reference_id    text not null unique
                  check (reference_id ~ '^FIT-[0-9]{8}-[A-F0-9]{10}$'),
  user_id         uuid references public.users(id) on delete set null,
  contact_email   text not null check (length(contact_email) between 3 and 254),
  category        text not null
                  check (category in ('account', 'listing', 'report', 'safety', 'technical', 'other')),
  message         text not null check (length(message) between 20 and 4000),
  related_reference text check (related_reference is null or length(related_reference) <= 120),
  status          text not null default 'open' check (status in ('open', 'resolved')),
  admin_note      text check (admin_note is null or length(admin_note) between 3 and 1000),
  resolved_by     uuid references public.users(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (
    (status = 'open' and resolved_by is null and resolved_at is null)
    or (status = 'resolved' and resolved_by is not null and resolved_at is not null)
  )
);

create index idx_support_requests_status_created
  on public.support_requests(status, created_at desc);
create index idx_support_requests_email_created
  on public.support_requests(lower(contact_email), created_at desc);
create index idx_support_requests_user_created
  on public.support_requests(user_id, created_at desc)
  where user_id is not null;

create trigger trg_support_requests_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;

-- There are intentionally no table policies. All clients, including admins,
-- use the narrow functions below; service_role retains operational access.
revoke all on public.support_requests from anon, authenticated;

create or replace function public.submit_support_request(
  p_category text,
  p_contact_email text,
  p_message text,
  p_related_reference text default null
)
returns jsonb as $$
declare
  v_user_id uuid := auth.uid();
  v_user_status text;
  v_email text := lower(trim(coalesce(p_contact_email, '')));
  v_message text := trim(coalesce(p_message, ''));
  v_reference text := nullif(trim(coalesce(p_related_reference, '')), '');
  v_reference_id text;
begin
  if coalesce(p_category, '') not in ('account', 'listing', 'report', 'safety', 'technical', 'other') then
    raise exception 'invalid support category' using errcode = '22023';
  end if;
  if length(v_email) < 3 or length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'a valid contact email is required' using errcode = '22023';
  end if;
  if length(v_message) < 20 or length(v_message) > 4000 then
    raise exception 'support message must be between 20 and 4000 characters'
      using errcode = '22023';
  end if;
  if v_reference is not null and length(v_reference) > 120 then
    raise exception 'related reference is too long' using errcode = '22023';
  end if;

  if v_user_id is not null then
    select u.status::text into v_user_status
    from public.users u where u.id = v_user_id;
    if v_user_status is distinct from 'active' then
      raise exception 'active account required' using errcode = '42501';
    end if;
  end if;

  -- Serialize a single email identity so concurrent submissions cannot race
  -- past the bounded V1 limits. Production gateway/CAPTCHA limits remain a
  -- complementary defence against attackers rotating addresses.
  perform pg_advisory_xact_lock(hashtextextended('support:' || v_email, 0));

  if (
    select count(*) from public.support_requests sr
    where lower(sr.contact_email) = v_email
      and sr.created_at >= now() - interval '15 minutes'
  ) >= 3 then
    raise exception 'support request rate limit exceeded; try again later'
      using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.support_requests sr
    where (
      lower(sr.contact_email) = v_email
      or (v_user_id is not null and sr.user_id = v_user_id)
    ) and sr.created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'daily support request limit exceeded'
      using errcode = 'P0001';
  end if;

  v_reference_id := 'FIT-' || to_char(current_timestamp at time zone 'UTC', 'YYYYMMDD')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.support_requests (
    reference_id, user_id, contact_email, category, message, related_reference
  ) values (
    v_reference_id, v_user_id, v_email, p_category, v_message, v_reference
  );

  -- Return no lookup token or internal state: the same compact confirmation is
  -- used for guests and signed-in users and cannot enumerate another request.
  return jsonb_build_object(
    'referenceId', v_reference_id,
    'received', true
  );
end;
$$ language plpgsql volatile security definer set search_path = public;

create or replace function public.admin_support_request_rows(
  p_query text default '',
  p_status text default 'open',
  p_category text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
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
  created_at timestamptz,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if coalesce(p_status, '') not in ('all', 'open', 'resolved')
    or coalesce(p_category, '') not in ('all', 'account', 'listing', 'report', 'safety', 'technical', 'other')
    or length(trim(coalesce(p_query, ''))) > 100
  then
    raise exception 'invalid support request filter' using errcode = '22023';
  end if;

  return query
  select
    sr.id, sr.reference_id, sr.user_id, sr.contact_email, sr.category,
    sr.message, sr.related_reference, sr.status, sr.admin_note,
    sr.resolved_by, sr.resolved_at, sr.created_at, count(*) over()
  from public.support_requests sr
  where (p_status = 'all' or sr.status = p_status)
    and (p_category = 'all' or sr.category = p_category)
    and (
      trim(coalesce(p_query, '')) = ''
      or sr.reference_id ilike '%' || trim(p_query) || '%'
      or sr.contact_email ilike '%' || trim(p_query) || '%'
      or sr.message ilike '%' || trim(p_query) || '%'
      or coalesce(sr.related_reference, '') ilike '%' || trim(p_query) || '%'
    )
  order by sr.created_at desc, sr.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_resolve_support_request(
  p_request_id uuid,
  p_note text
)
returns jsonb as $$
declare
  v_note text := public.require_admin_reason(p_note);
  v_before jsonb;
  v_after jsonb;
begin
  select to_jsonb(sr) into v_before
  from public.support_requests sr
  where sr.id = p_request_id
  for update;

  if v_before is null then
    raise exception 'support request not found' using errcode = 'P0002';
  end if;
  if v_before ->> 'status' = 'resolved' then
    raise exception 'support request is already resolved' using errcode = 'P0001';
  end if;

  update public.support_requests
  set status = 'resolved', admin_note = v_note,
      resolved_by = auth.uid(), resolved_at = now()
  where id = p_request_id;

  select to_jsonb(sr) into v_after
  from public.support_requests sr where sr.id = p_request_id;

  perform public.record_admin_action(
    'support_request.resolved', p_request_id::text, 'support_request',
    v_note,
    v_before - array['contact_email', 'message'],
    v_after - array['contact_email', 'message']
  );
  return v_after;
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke all on function public.submit_support_request(text, text, text, text) from public;
revoke all on function public.admin_support_request_rows(text, text, text, integer, integer) from public;
revoke all on function public.admin_resolve_support_request(uuid, text) from public;

grant execute on function public.submit_support_request(text, text, text, text) to anon, authenticated;
grant execute on function public.admin_support_request_rows(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_resolve_support_request(uuid, text) to authenticated;
