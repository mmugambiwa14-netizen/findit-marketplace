begin;

-- Present every privileged decision in one cursor-paginated activity stream.
-- The existing audit_logs trail remains the canonical source for ordinary
-- moderation, while business reviews and recommendation configuration changes
-- are projected into the same read model without copying or mutating history.
create or replace function private.admin_unified_audit_activity_page(
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
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 100
     or length(normalized_query) > 100
     or p_target_type not in (
       'all', 'user', 'property', 'car', 'machinery', 'service',
       'report', 'tour_report', 'listing_tour', 'category',
       'support_request', 'business_review', 'recommendation_configuration',
       'managed_listing_request'
     )
     or ((p_cursor_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid audit page' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  with activity as (
    select
      a.id as audit_id,
      a.admin_user_id,
      u.email as admin_email,
      a.action_performed,
      a.target_record_id,
      a.target_record_type,
      a.reason,
      a.result,
      a.correlation_id,
      a.created_at
    from public.audit_logs a
    left join public.users u on u.id = a.admin_user_id

    union all

    select
      md5('business-review:' || e.id::text)::uuid,
      e.actor_user_id,
      u.email,
      'business_review.' || e.action,
      coalesce(e.category_approval_id, e.application_id)::text,
      'business_review',
      e.message,
      e.new_status,
      null::uuid,
      e.created_at
    from public.business_review_events e
    left join public.users u on u.id = e.actor_user_id

    union all

    select
      md5('recommendation-configuration:' || a.id::text)::uuid,
      a.actor_id,
      u.email,
      'recommendation.' || a.action,
      a.entity_id::text,
      'recommendation_configuration',
      null::text,
      a.entity_type,
      null::uuid,
      a.created_at
    from public.recommendation_configuration_audit a
    left join public.users u on u.id = a.actor_id
  ), filtered as (
    select activity.* from activity
    where (p_target_type = 'all' or activity.target_record_type = p_target_type)
      and (
        normalized_query = ''
        or coalesce(admin_email, '') ilike '%' || escaped_query || '%' escape E'\\'
        or action_performed ilike '%' || escaped_query || '%' escape E'\\'
        or coalesce(target_record_id, '') ilike '%' || escaped_query || '%' escape E'\\'
        or coalesce(reason, '') ilike '%' || escaped_query || '%' escape E'\\'
        or coalesce(result, '') ilike '%' || escaped_query || '%' escape E'\\'
      )
      and (p_cursor_at is null or (activity.created_at, activity.audit_id) < (p_cursor_at, p_cursor_id))
  )
  select
    filtered.audit_id,
    filtered.admin_user_id,
    coalesce(filtered.admin_email, 'System'),
    filtered.action_performed,
    filtered.target_record_id,
    filtered.target_record_type,
    filtered.reason,
    filtered.result,
    filtered.correlation_id,
    filtered.created_at
  from filtered
  order by filtered.created_at desc, filtered.audit_id desc
  limit p_limit + 1;
end;
$$;

revoke all on function private.admin_unified_audit_activity_page(text,text,integer,timestamptz,uuid) from public, anon, authenticated, service_role;

create or replace function public.admin_unified_audit_activity_page(
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
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_unified_audit_activity_page($1, $2, $3, $4, $5);
$$;

revoke all on function public.admin_unified_audit_activity_page(text,text,integer,timestamptz,uuid) from public, anon;
grant execute on function public.admin_unified_audit_activity_page(text,text,integer,timestamptz,uuid) to authenticated;

commit;
