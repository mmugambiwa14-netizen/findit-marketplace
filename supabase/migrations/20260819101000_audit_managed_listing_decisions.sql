begin;

-- Managed-listing decisions are commercial moderation decisions and must have
-- the same before/after evidence as the other admin operations.
create or replace function private.admin_update_managed_listing_request(
  p_request_id uuid,
  p_status text,
  p_message text default null,
  p_assigned_to uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
  after_row jsonb;
  normalized_message text := nullif(trim(p_message), '');
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('reviewing','accepted','needs_information','declined','published','cancelled') then
    raise exception 'Unsupported managed listing status';
  end if;
  if p_status in ('needs_information','declined') and normalized_message is null then
    raise exception 'A reviewer message is required';
  end if;

  select to_jsonb(request_row) into before_row
  from public.managed_listing_requests request_row
  where request_row.id = p_request_id
  for update;
  if not found then raise exception 'Managed listing request not found'; end if;

  update public.managed_listing_requests
  set status = p_status,
      reviewer_message = normalized_message,
      assigned_to = coalesce(p_assigned_to, assigned_to),
      updated_at = now()
  where id = p_request_id
  returning to_jsonb(managed_listing_requests.*) into after_row;

  perform public.record_admin_action(
    'managed_listing.' || p_status,
    p_request_id::text,
    'managed_listing_request',
    coalesce(normalized_message, 'Managed listing request status changed'),
    before_row,
    after_row
  );
end;
$$;

revoke all on function private.admin_update_managed_listing_request(uuid,text,text,uuid) from public, anon, authenticated, service_role;

create or replace function public.admin_update_managed_listing_request(
  p_request_id uuid,
  p_status text,
  p_message text default null,
  p_assigned_to uuid default null
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.admin_update_managed_listing_request($1, $2, $3, $4);
$$;

revoke all on function public.admin_update_managed_listing_request(uuid,text,text,uuid) from public, anon;
grant execute on function public.admin_update_managed_listing_request(uuid,text,text,uuid) to authenticated;

commit;
