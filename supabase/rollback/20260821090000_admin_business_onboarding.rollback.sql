-- Reverses 20260821090000_admin_business_onboarding.sql.
--
-- Removes the admin-initiated onboarding entry points and restores the Aug-6
-- definition of admin_review_business_application, which accepts only
-- start_review, request_information and reject and writes no audit_logs row.
--
-- The review ledger's action constraint is only narrowed back when no event
-- recorded through the forward migration is still present. Evidence rows are
-- never removed to satisfy a constraint: a rollback that discarded review
-- history would destroy the record of decisions that were genuinely made.

begin;

drop function if exists public.admin_onboard_business(
  uuid, text, text, text, text, text, text, text, text[], text, text, text, text
);
drop function if exists public.admin_search_business_accounts(text, integer);

create or replace function public.admin_review_business_application(
  p_application_id uuid,
  p_action text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous text;
  v_next text;
  v_event text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select status into v_previous from public.business_applications where id = p_application_id for update;
  if v_previous is null then raise exception 'Application not found'; end if;

  case p_action
    when 'start_review' then v_next := 'reviewing'; v_event := 'application_review_started';
    when 'request_information' then v_next := 'needs_information'; v_event := 'application_information_requested';
    when 'reject' then v_next := 'rejected'; v_event := 'application_rejected';
    else raise exception 'Unsupported review action';
  end case;

  if p_action in ('request_information','reject') and nullif(trim(p_message), '') is null then
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
    p_application_id, auth.uid(), v_event, v_previous, v_next, nullif(trim(p_message), '')
  );
end;
$function$;

do $constraint$
declare
  v_name text;
  v_forward_events bigint;
begin
  select count(*)
  into v_forward_events
  from public.business_review_events
  where action in (
    'application_approved',
    'application_onboarded_by_admin',
    'listing_published_for_business'
  );

  if v_forward_events > 0 then
    raise notice
      'business_review_events keeps the widened action constraint: % onboarding events remain',
      v_forward_events;
    return;
  end if;

  for v_name in
    select constraint_record.conname
    from pg_constraint constraint_record
    join pg_class table_record on table_record.oid = constraint_record.conrelid
    join pg_namespace schema_record on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname = 'business_review_events'
      and constraint_record.contype = 'c'
      and pg_get_constraintdef(constraint_record.oid) like '%application_review_started%'
  loop
    execute format('alter table public.business_review_events drop constraint %I', v_name);
  end loop;

  alter table public.business_review_events
    add constraint business_review_events_action_check
    check (action in (
      'application_review_started',
      'application_information_requested',
      'application_rejected',
      'category_approved',
      'category_rejected',
      'category_suspended',
      'category_reinstated'
    ));
end;
$constraint$;

commit;
