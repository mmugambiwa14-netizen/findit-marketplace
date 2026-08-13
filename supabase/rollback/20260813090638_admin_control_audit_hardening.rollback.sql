begin;

drop trigger if exists business_review_events_audit on public.business_review_events;
drop function if exists private.audit_business_review_event();

-- Restore the pre-hardening business review implementations.  Existing
-- review-event rows and audit rows are intentionally retained.
create or replace function private.admin_review_business_application(
  p_application_id uuid,
  p_action text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $business_application$
declare
  v_previous text;
  v_next text;
  v_event text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select status into v_previous
  from public.business_applications
  where id = p_application_id
  for update;
  if not found then raise exception 'Application not found'; end if;

  case p_action
    when 'start_review' then v_next := 'reviewing'; v_event := 'application_review_started';
    when 'request_information' then v_next := 'needs_information'; v_event := 'application_information_requested';
    when 'reject' then v_next := 'rejected'; v_event := 'application_rejected';
    else raise exception 'Unsupported review action';
  end case;

  if p_action in ('request_information', 'reject')
    and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required';
  end if;

  update public.business_applications
  set status = v_next,
      reviewer_message = nullif(trim(p_message), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = p_application_id;

  insert into public.business_review_events (
    application_id, actor_user_id, action, previous_status, new_status, message
  ) values (
    p_application_id, auth.uid(), v_event, v_previous, v_next,
    nullif(trim(p_message), '')
  );
end
$business_application$;

create or replace function private.admin_review_business_category(
  p_category_approval_id uuid,
  p_action text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $business_category$
declare
  v_application_id uuid;
  v_previous text;
  v_next text;
  v_event text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select business_application_id, status
  into v_application_id, v_previous
  from public.business_category_approvals
  where id = p_category_approval_id
  for update;
  if not found then raise exception 'Category request not found'; end if;

  case p_action
    when 'approve' then
      v_next := 'approved';
      v_event := case when v_previous = 'suspended' then 'category_reinstated' else 'category_approved' end;
    when 'reject' then v_next := 'rejected'; v_event := 'category_rejected';
    when 'suspend' then v_next := 'suspended'; v_event := 'category_suspended';
    else raise exception 'Unsupported category action';
  end case;

  if p_action in ('reject', 'suspend')
    and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required';
  end if;

  update public.business_category_approvals
  set status = v_next,
      reviewer_message = nullif(trim(p_message), ''),
      approved_at = case when v_next = 'approved' then now() else approved_at end,
      approved_by = case when v_next = 'approved' then auth.uid() else approved_by end,
      updated_at = now()
  where id = p_category_approval_id;

  if v_next = 'approved' then
    update public.business_applications
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
    where id = v_application_id and status <> 'approved';
  elsif not exists (
    select 1 from public.business_category_approvals
    where business_application_id = v_application_id and status = 'approved'
  ) then
    update public.business_applications
    set status = case when exists (
      select 1 from public.business_category_approvals
      where business_application_id = v_application_id and status = 'pending'
    ) then 'reviewing' else 'rejected' end,
    reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
    where id = v_application_id;
  end if;

  insert into public.business_review_events (
    application_id, category_approval_id, actor_user_id, action,
    previous_status, new_status, message
  ) values (
    v_application_id, p_category_approval_id, auth.uid(), v_event,
    v_previous, v_next, nullif(trim(p_message), '')
  );
end
$business_category$;

-- The previous implementation is restored by replaying the migration that
-- originally created this function.  This rollback intentionally does not
-- delete audit rows or business/managed-listing data.
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
  if p_status not in ('reviewing','accepted','needs_information','declined','published','cancelled') then
    raise exception 'Unsupported managed listing status';
  end if;
  if p_status in ('needs_information','declined') and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required';
  end if;

  update public.managed_listing_requests
  set status = p_status,
      reviewer_message = nullif(trim(p_message), ''),
      assigned_to = coalesce(p_assigned_to, assigned_to),
      updated_at = now()
  where id = p_request_id;
  if not found then raise exception 'Managed listing request not found'; end if;
end;
$$;

revoke all on function private.admin_update_managed_listing_request(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.admin_update_managed_listing_request(uuid, text, text, uuid)
  to authenticated;

commit;
