-- The forward migration only replaces the privileged function. Restore it by
-- replaying the previous definition from 20260806053000 if needed.
-- This capsule intentionally does not delete existing audit evidence.
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
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('reviewing','accepted','needs_information','declined','published','cancelled') then raise exception 'Unsupported managed listing status'; end if;
  if p_status in ('needs_information','declined') and nullif(trim(p_message), '') is null then raise exception 'A reviewer message is required'; end if;
  update public.managed_listing_requests set status = p_status, reviewer_message = nullif(trim(p_message), ''), assigned_to = coalesce(p_assigned_to, assigned_to), updated_at = now() where id = p_request_id;
  if not found then raise exception 'Managed listing request not found'; end if;
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
