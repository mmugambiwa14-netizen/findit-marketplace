begin;

-- Business review events are the source of truth for the curated workflow,
-- but they were not visible in the founder audit log.  Keep the existing
-- event history and mirror each privileged decision into the common audit
-- stream without copying private applicant fields.
create or replace function private.audit_business_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.record_admin_action(
    case when new.category_approval_id is null
      then 'business_application.' || new.action
      else 'business_category.' || new.action
    end,
    coalesce(new.category_approval_id, new.application_id)::text,
    case when new.category_approval_id is null
      then 'business_application'
      else 'business_category'
    end,
    left(coalesce(nullif(trim(new.message), ''), 'Business review decision: ' || new.action), 1000),
    jsonb_build_object('status', new.previous_status),
    jsonb_build_object('status', new.new_status),
    gen_random_uuid()
  );
  return new;
end;
$$;

revoke all on function private.audit_business_review_event() from public, anon, authenticated;
drop trigger if exists business_review_events_audit on public.business_review_events;
create trigger business_review_events_audit
after insert on public.business_review_events
for each row execute function private.audit_business_review_event();

-- Business review buttons are state-aware in the UI, but the RPC must enforce
-- the same transition graph for direct callers and stale admin sessions.
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
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select status
  into v_previous
  from public.business_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  case p_action
    when 'start_review' then
      v_next := 'reviewing';
      v_event := 'application_review_started';
    when 'request_information' then
      v_next := 'needs_information';
      v_event := 'application_information_requested';
    when 'reject' then
      v_next := 'rejected';
      v_event := 'application_rejected';
    else
      raise exception 'Unsupported review action' using errcode = '22023';
  end case;

  if not (
    (v_previous = 'submitted' and p_action in ('start_review', 'request_information', 'reject'))
    or (v_previous = 'reviewing' and p_action in ('request_information', 'reject'))
    or (v_previous = 'needs_information' and p_action in ('start_review', 'reject'))
  ) then
    raise exception 'Invalid business application state transition' using errcode = '22023';
  end if;

  if p_action in ('request_information', 'reject')
    and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required' using errcode = '22023';
  end if;

  update public.business_applications
  set status = v_next,
      reviewer_message = nullif(trim(p_message), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = p_application_id;

  insert into public.business_review_events (
    application_id,
    actor_user_id,
    action,
    previous_status,
    new_status,
    message
  ) values (
    p_application_id,
    auth.uid(),
    v_event,
    v_previous,
    v_next,
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
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select business_application_id, status
  into v_application_id, v_previous
  from public.business_category_approvals
  where id = p_category_approval_id
  for update;

  if not found then
    raise exception 'Category request not found' using errcode = 'P0002';
  end if;

  case p_action
    when 'approve' then
      v_next := 'approved';
      v_event := case when v_previous = 'suspended'
        then 'category_reinstated'
        else 'category_approved'
      end;
    when 'reject' then
      v_next := 'rejected';
      v_event := 'category_rejected';
    when 'suspend' then
      v_next := 'suspended';
      v_event := 'category_suspended';
    else
      raise exception 'Unsupported category action' using errcode = '22023';
  end case;

  if not (
    (v_previous = 'pending' and p_action in ('approve', 'reject'))
    or (v_previous = 'approved' and p_action = 'suspend')
    or (v_previous in ('suspended', 'rejected') and p_action = 'approve')
  ) then
    raise exception 'Invalid business category state transition' using errcode = '22023';
  end if;

  if p_action in ('reject', 'suspend')
    and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required' using errcode = '22023';
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
    set status = 'approved',
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        updated_at = now()
    where id = v_application_id
      and status <> 'approved';
  elsif not exists (
    select 1
    from public.business_category_approvals
    where business_application_id = v_application_id
      and status = 'approved'
  ) then
    update public.business_applications
    set status = case when exists (
          select 1
          from public.business_category_approvals
          where business_application_id = v_application_id
            and status = 'pending'
        ) then 'reviewing' else 'rejected' end,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        updated_at = now()
    where id = v_application_id;
  end if;

  insert into public.business_review_events (
    application_id,
    category_approval_id,
    actor_user_id,
    action,
    previous_status,
    new_status,
    message
  ) values (
    v_application_id,
    p_category_approval_id,
    auth.uid(),
    v_event,
    v_previous,
    v_next,
    nullif(trim(p_message), '')
  );
end
$business_category$;

-- Make managed-listing moderation a real state machine.  Previously the
-- client hid invalid transitions, but a direct authenticated RPC call could
-- move a request from any state to any other state.  The private function is
-- the implementation behind the public invoker wrapper created by the RPC
-- hardening migrations.
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
  v_previous text;
  v_previous_assigned_to uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select status, assigned_to
  into v_previous, v_previous_assigned_to
  from public.managed_listing_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Managed listing request not found' using errcode = 'P0002';
  end if;

  if p_status not in ('reviewing', 'accepted', 'needs_information', 'declined', 'published', 'cancelled') then
    raise exception 'Unsupported managed listing status' using errcode = '22023';
  end if;

  if not (
    (v_previous = 'submitted' and p_status in ('reviewing', 'accepted', 'needs_information', 'declined', 'cancelled'))
    or (v_previous = 'reviewing' and p_status in ('accepted', 'needs_information', 'declined', 'cancelled'))
    or (v_previous = 'needs_information' and p_status in ('reviewing', 'accepted', 'declined', 'cancelled'))
    or (v_previous = 'accepted' and p_status in ('published', 'cancelled'))
  ) then
    raise exception 'Invalid managed listing state transition' using errcode = '22023';
  end if;

  if p_status in ('needs_information', 'declined', 'cancelled')
    and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required' using errcode = '22023';
  end if;

  if p_assigned_to is not null and not exists (
    select 1
    from public.users
    where id = p_assigned_to
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception 'Assigned reviewer must be an active administrator' using errcode = '22023';
  end if;

  update public.managed_listing_requests
  set status = p_status,
      reviewer_message = nullif(trim(p_message), ''),
      assigned_to = coalesce(p_assigned_to, assigned_to),
      updated_at = now()
  where id = p_request_id;

  perform public.record_admin_action(
    'managed_listing.status_changed',
    p_request_id::text,
    'managed_listing_request',
    left(coalesce(nullif(trim(p_message), ''), 'Managed listing request moved to ' || p_status || '.'), 1000),
    jsonb_build_object('status', v_previous, 'assigned_to', v_previous_assigned_to),
    jsonb_build_object('status', p_status, 'assigned_to', coalesce(p_assigned_to, v_previous_assigned_to)),
    gen_random_uuid()
  );
end;
$$;

revoke all on function private.admin_update_managed_listing_request(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.admin_update_managed_listing_request(uuid, text, text, uuid)
  to authenticated;

-- The managed request status trigger continues to send the user notification;
-- the audit row is written in the same transaction by the private RPC, so
-- moderation evidence and user delivery cannot drift apart.
comment on function private.admin_update_managed_listing_request(uuid, text, text, uuid)
  is 'Founder-only managed listing state machine with audit coverage';

commit;
