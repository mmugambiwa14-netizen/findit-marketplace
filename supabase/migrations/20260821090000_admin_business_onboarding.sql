-- 20260821090000_admin_business_onboarding.sql
--
-- Admin-initiated business onboarding.
--
-- Until now a business could only enter the curated marketplace by submitting
-- its own application and waiting for a per-category decision. An operator who
-- signed a business up by phone, at a dealership, or in person had no way to
-- record that: `admin_review_business_application` accepts only start_review,
-- request_information and reject, and approval was a side effect of approving
-- one category at a time.
--
-- This migration adds the missing direction. An admin can create an already
-- approved application on behalf of an account, and can approve a pending
-- application outright. Both paths write the same business_review_events rows
-- the reactive path writes, and both record an audit_logs entry, so an
-- admin-created business is no less traceable than a self-served one.

begin;

-- The review ledger gains the admin-initiated actions. The original constraint
-- was declared inline, so it is dropped by definition rather than by a name
-- this migration would have to guess.
do $constraint$
declare
  v_name text;
begin
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
end;
$constraint$;

alter table public.business_review_events
  add constraint business_review_events_action_allowed
  check (action in (
    'application_review_started',
    'application_information_requested',
    'application_rejected',
    'application_approved',
    'application_onboarded_by_admin',
    'category_approved',
    'category_rejected',
    'category_suspended',
    'category_reinstated',
    'listing_published_for_business'
  ));

-- ---------------------------------------------------------------------------
-- Account lookup for the onboarding screen.
--
-- The admin needs the account plus the publishing state it already has, so the
-- screen can say "this account is already approved for Cars" instead of
-- silently re-approving. admin_user_rows_page cannot answer that.
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_business_accounts(
  p_query text default '',
  p_limit integer default 10
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  account_status text,
  application_id uuid,
  application_status text,
  approved_categories text[],
  pending_categories text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_escaped text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if length(v_query) < 2 or length(v_query) > 120 then
    raise exception 'Search by at least two characters of an email address or name'
      using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 25 then
    raise exception 'Unsupported result limit' using errcode = '22023';
  end if;

  v_escaped := replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  select
    account.id,
    account.email,
    account.full_name,
    account.phone,
    account.status::text,
    application.id,
    application.status,
    coalesce((
      select array_agg(approval.category order by approval.category)
      from public.business_category_approvals approval
      where approval.user_id = account.id and approval.status = 'approved'
    ), array[]::text[]),
    coalesce((
      select array_agg(approval.category order by approval.category)
      from public.business_category_approvals approval
      where approval.user_id = account.id and approval.status = 'pending'
    ), array[]::text[])
  from public.users account
  left join public.business_applications application
    on application.user_id = account.id
   and application.status in ('submitted', 'reviewing', 'needs_information', 'approved')
  where account.email ilike '%' || v_escaped || '%' escape E'\\'
     or coalesce(account.full_name, '') ilike '%' || v_escaped || '%' escape E'\\'
  order by account.created_at desc
  limit p_limit;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Admin-initiated onboarding.
--
-- If the account already has an active application, its own submitted details
-- are preserved and only the publishing decision is recorded: an operator
-- completing a signup must not silently overwrite what the business wrote
-- about itself.
-- ---------------------------------------------------------------------------
create or replace function public.admin_onboard_business(
  p_user_id uuid,
  p_business_name text,
  p_contact_name text,
  p_business_email text,
  p_business_phone text,
  p_country_code text,
  p_city text,
  p_description text,
  p_categories text[],
  p_expected_inventory_band text default '1-10',
  p_website_url text default null,
  p_social_url text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_categories text[];
  v_category text;
  v_application_id uuid;
  v_previous_status text;
  v_reused boolean := false;
  v_approval_id uuid;
  v_previous_category_status text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_business_name text := trim(coalesce(p_business_name, ''));
  v_contact_name text := trim(coalesce(p_contact_name, ''));
  v_business_email text := lower(trim(coalesce(p_business_email, '')));
  v_business_phone text := trim(coalesce(p_business_phone, ''));
  v_country_code text := upper(trim(coalesce(p_country_code, '')));
  v_city text := trim(coalesce(p_city, ''));
  v_description text := trim(coalesce(p_description, ''));
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select array_agg(distinct requested order by requested)
  into v_categories
  from unnest(coalesce(p_categories, array[]::text[])) as requested
  where requested in ('property', 'car', 'machinery', 'service');

  if v_categories is null or array_length(v_categories, 1) is null then
    raise exception 'Choose at least one publishing category' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.users where id = p_user_id and status = 'active'
  ) then
    raise exception 'Onboarding requires an active account' using errcode = '22023';
  end if;

  -- Reuse whatever active application the account already has. The partial
  -- unique index permits exactly one, so inserting a second would fail with a
  -- constraint error the operator cannot act on.
  select id, status
  into v_application_id, v_previous_status
  from public.business_applications
  where user_id = p_user_id
    and status in ('submitted', 'reviewing', 'needs_information', 'approved')
  for update;

  if v_application_id is null then
    if char_length(v_business_name) not between 2 and 160 then
      raise exception 'Business name must be between 2 and 160 characters' using errcode = '22023';
    end if;
    if char_length(v_contact_name) not between 2 and 120 then
      raise exception 'Contact name must be between 2 and 120 characters' using errcode = '22023';
    end if;
    if v_business_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or char_length(v_business_email) > 254 then
      raise exception 'Enter a valid business email address' using errcode = '22023';
    end if;
    if char_length(v_business_phone) not between 5 and 40 then
      raise exception 'Enter a business phone number' using errcode = '22023';
    end if;
    if v_country_code !~ '^[A-Z]{2}$' then
      raise exception 'Enter a two-letter country code' using errcode = '22023';
    end if;
    if char_length(v_city) not between 2 and 120 then
      raise exception 'Enter the city the business operates from' using errcode = '22023';
    end if;
    if char_length(v_description) not between 20 and 3000 then
      raise exception 'Describe the business in between 20 and 3000 characters' using errcode = '22023';
    end if;
    if coalesce(p_expected_inventory_band, '') not in ('1-10', '11-50', '51-200', '200+') then
      raise exception 'Choose a supported expected inventory band' using errcode = '22023';
    end if;

    insert into public.business_applications (
      user_id, business_name, contact_name, business_email, business_phone,
      country_code, city, description, website_url, social_url,
      expected_inventory_band, status, reviewer_message, reviewed_at, reviewed_by
    ) values (
      p_user_id, v_business_name, v_contact_name, v_business_email, v_business_phone,
      v_country_code, v_city, v_description,
      nullif(trim(coalesce(p_website_url, '')), ''),
      nullif(trim(coalesce(p_social_url, '')), ''),
      p_expected_inventory_band, 'approved', v_note, now(), v_actor
    )
    returning id into v_application_id;
    v_previous_status := 'not_started';
  else
    v_reused := true;
    update public.business_applications
    set status = 'approved',
        reviewer_message = coalesce(v_note, reviewer_message),
        reviewed_at = now(),
        reviewed_by = v_actor,
        updated_at = now()
    where id = v_application_id;
  end if;

  foreach v_category in array v_categories
  loop
    select id, status
    into v_approval_id, v_previous_category_status
    from public.business_category_approvals
    where user_id = p_user_id and category = v_category
    for update;

    if v_approval_id is null then
      insert into public.business_category_approvals (
        business_application_id, user_id, category, status,
        reviewer_message, approved_at, approved_by
      ) values (
        v_application_id, p_user_id, v_category, 'approved', v_note, now(), v_actor
      )
      returning id into v_approval_id;
      v_previous_category_status := 'not_requested';
    else
      update public.business_category_approvals
      set business_application_id = v_application_id,
          status = 'approved',
          reviewer_message = coalesce(v_note, reviewer_message),
          approved_at = now(),
          approved_by = v_actor,
          updated_at = now()
      where id = v_approval_id;
    end if;

    insert into public.business_review_events (
      application_id, category_approval_id, actor_user_id, action,
      previous_status, new_status, message
    ) values (
      v_application_id, v_approval_id, v_actor,
      case when v_previous_category_status = 'suspended'
        then 'category_reinstated'
        else 'category_approved'
      end,
      v_previous_category_status, 'approved', v_note
    );
  end loop;

  insert into public.business_review_events (
    application_id, actor_user_id, action, previous_status, new_status, message
  ) values (
    v_application_id, v_actor, 'application_onboarded_by_admin',
    v_previous_status, 'approved', v_note
  );

  perform public.record_admin_action(
    'business.onboard',
    v_application_id::text,
    'business_application',
    v_note,
    jsonb_build_object('application_status', v_previous_status),
    jsonb_build_object(
      'application_status', 'approved',
      'user_id', p_user_id,
      'categories', to_jsonb(v_categories),
      'reused_existing_application', v_reused
    )
  );

  return jsonb_build_object(
    'application_id', v_application_id,
    'user_id', p_user_id,
    'categories', to_jsonb(v_categories),
    'reused_existing_application', v_reused
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Whole-application approval.
--
-- Replaces the Aug-6 definition to add the `approve` action. Every other
-- action keeps its original behaviour; the audit_logs write is new and applies
-- to all of them, because a decision that changes what an account may publish
-- belongs in the same ledger as every other admin action.
-- ---------------------------------------------------------------------------
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
  v_actor uuid := auth.uid();
  v_previous text;
  v_next text;
  v_event text;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_approval record;
  v_approved_count integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select status into v_previous
  from public.business_applications
  where id = p_application_id
  for update;
  if v_previous is null then raise exception 'Application not found'; end if;

  case p_action
    when 'start_review' then v_next := 'reviewing'; v_event := 'application_review_started';
    when 'request_information' then v_next := 'needs_information'; v_event := 'application_information_requested';
    when 'approve' then v_next := 'approved'; v_event := 'application_approved';
    when 'reject' then v_next := 'rejected'; v_event := 'application_rejected';
    else raise exception 'Unsupported review action';
  end case;

  if p_action in ('request_information', 'reject') and v_message is null then
    raise exception 'A reviewer message is required';
  end if;

  if p_action = 'approve' then
    for v_approval in
      select id, status
      from public.business_category_approvals
      where business_application_id = p_application_id
        and status in ('pending', 'suspended')
      order by category
      for update
    loop
      update public.business_category_approvals
      set status = 'approved',
          reviewer_message = coalesce(v_message, reviewer_message),
          approved_at = now(),
          approved_by = v_actor,
          updated_at = now()
      where id = v_approval.id;

      insert into public.business_review_events (
        application_id, category_approval_id, actor_user_id, action,
        previous_status, new_status, message
      ) values (
        p_application_id, v_approval.id, v_actor,
        case when v_approval.status = 'suspended'
          then 'category_reinstated'
          else 'category_approved'
        end,
        v_approval.status, 'approved', v_message
      );
    end loop;

    select count(*)
    into v_approved_count
    from public.business_category_approvals
    where business_application_id = p_application_id and status = 'approved';

    -- Approving an application that grants nothing would report success while
    -- leaving the business unable to publish anything.
    if v_approved_count = 0 then
      raise exception 'This application has no category left to approve';
    end if;
  end if;

  update public.business_applications
  set status = v_next,
      reviewer_message = v_message,
      reviewed_at = now(),
      reviewed_by = v_actor,
      updated_at = now()
  where id = p_application_id;

  insert into public.business_review_events (
    application_id, actor_user_id, action, previous_status, new_status, message
  ) values (
    p_application_id, v_actor, v_event, v_previous, v_next, v_message
  );

  perform public.record_admin_action(
    'business.application_' || p_action,
    p_application_id::text,
    'business_application',
    v_message,
    jsonb_build_object('application_status', v_previous),
    jsonb_build_object('application_status', v_next)
  );
end;
$function$;

revoke all on function public.admin_search_business_accounts(text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_search_business_accounts(text, integer)
  to authenticated;

revoke all on function public.admin_onboard_business(
  uuid, text, text, text, text, text, text, text, text[], text, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_onboard_business(
  uuid, text, text, text, text, text, text, text, text[], text, text, text, text
) to authenticated;

revoke all on function public.admin_review_business_application(uuid, text, text)
  from public, anon;
grant execute on function public.admin_review_business_application(uuid, text, text)
  to authenticated;

comment on function public.admin_onboard_business(
  uuid, text, text, text, text, text, text, text, text[], text, text, text, text
) is 'Creates or completes an approved business application on behalf of an account, with review-event and audit-log evidence.';
comment on function public.admin_search_business_accounts(text, integer)
  is 'Finds an account to onboard and reports the publishing categories it already holds.';

commit;
