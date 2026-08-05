begin;

-- Correct concrete defects surfaced by the clean-reset plpgsql checker after
-- the post-0101 RPC boundary is applied. Existing public wrappers, signatures,
-- grants and trigger dependencies are preserved.

do $migration$
declare
  target_signature text;
  target_oid regprocedure;
  original_definition text;
  corrected_definition text;
begin
  foreach target_signature in array array[
    'private.admin_review_report(uuid,public.report_status,text)',
    'private.admin_tour_queue(text,text,integer,integer)',
    'private.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'
  ] loop
    target_oid := to_regprocedure(target_signature);
    if target_oid is null then
      raise exception 'missing function required for variable-conflict repair: %', target_signature;
    end if;

    select pg_get_functiondef(target_oid::oid)
    into original_definition;

    if position('#variable_conflict use_column' in original_definition) = 0 then
      corrected_definition := replace(
        original_definition,
        E'AS $function$\n',
        E'AS $function$\n#variable_conflict use_column\n'
      );
      if corrected_definition = original_definition then
        raise exception 'could not inject variable-conflict directive into %', target_signature;
      end if;
      execute corrected_definition;
    end if;
  end loop;

  foreach target_signature in array array[
    'private.bind_response_peek(uuid,uuid[])',
    'private.apply_pending_response_peek_binding()'
  ] loop
    target_oid := to_regprocedure(target_signature);
    if target_oid is null then
      raise exception 'missing function required for Peek alert repair: %', target_signature;
    end if;

    select pg_get_functiondef(target_oid::oid)
    into original_definition;

    corrected_definition := replace(original_definition, '''info''', '''system''');
    corrected_definition := replace(
      corrected_definition,
      '''peek_response_available''',
      '''peek_request_answered'''
    );

    if corrected_definition = original_definition then
      raise exception 'Peek alert repair made no change to %', target_signature;
    end if;
    execute corrected_definition;
  end loop;
end;
$migration$;

create or replace function public.ensure_recommendation_event_partition(p_month date)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  month_start date;
  month_end date;
  partition_name text;
  existing_partition regclass;
begin
  if p_month is null then
    raise exception 'partition month is required' using errcode = '22023';
  end if;

  month_start := date_trunc('month', p_month)::date;
  month_end := (date_trunc('month', p_month) + interval '1 month')::date;
  partition_name := 'recommendation_events_' || to_char(month_start, 'YYYYMM');
  existing_partition := to_regclass(format('public.%I', partition_name));

  if existing_partition is not null then
    return partition_name;
  end if;

  lock table public.recommendation_events_default in access exclusive mode;

  existing_partition := to_regclass(format('public.%I', partition_name));
  if existing_partition is not null then
    return partition_name;
  end if;

  create temporary table if not exists recommendation_events_partition_buffer
    (like public.recommendation_events including defaults including constraints)
    on commit drop;

  execute 'truncate table pg_temp.recommendation_events_partition_buffer';
  execute $sql$
    insert into pg_temp.recommendation_events_partition_buffer (
      id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
      seller_id, recommendation_request_id, recommendation_service, reason_code,
      context, expires_at
    )
    select
      id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
      seller_id, recommendation_request_id, recommendation_service, reason_code,
      context, expires_at
    from public.recommendation_events_default
    where occurred_at >= $1
      and occurred_at < $2
  $sql$ using month_start::timestamptz, month_end::timestamptz;

  delete from public.recommendation_events_default
  where occurred_at >= month_start::timestamptz
    and occurred_at < month_end::timestamptz;

  execute format(
    'create table public.%I partition of public.recommendation_events for values from (%L) to (%L)',
    partition_name,
    month_start,
    month_end
  );
  execute format('alter table public.%I enable row level security', partition_name);
  execute format('revoke all on table public.%I from public, anon, authenticated', partition_name);

  execute $sql$
    insert into public.recommendation_events (
      id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
      seller_id, recommendation_request_id, recommendation_service, reason_code,
      context, expires_at
    )
    select
      id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
      seller_id, recommendation_request_id, recommendation_service, reason_code,
      context, expires_at
    from pg_temp.recommendation_events_partition_buffer
  $sql$;

  return partition_name;
end;
$function$;

create or replace function private.prepare_own_account_deletion(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_super_admin boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if upper(trim(coalesce(p_confirmation, ''))) <> 'DELETE' then raise exception 'Type DELETE to confirm'; end if;

  select role, super_admin into v_role, v_super_admin from public.users where id = v_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  if v_role = 'admin' or coalesce(v_super_admin, false) then raise exception 'Administrator accounts must be transferred before deletion'; end if;

  update public.listings set status = 'unavailable', contact_phone = null, contact_whatsapp = null, contact_email = null, updated_at = now() where seller_id = v_user_id;
  update public.services set status = 'unavailable', contact_phone = null, contact_whatsapp = null, contact_email = null, updated_at = now() where provider_id = v_user_id;
  update public.business_profiles
     set company_name = 'Deleted business', registration_number = null, issuing_body = null,
         phone = null, email = null, website = null, city = null, address = null,
         description = null, avatar_url = null, avatar_storage_path = null,
         social_links = '{}'::jsonb, verified = false, updated_at = now()
   where user_id = v_user_id;

  delete from public.saved_listings where user_id = v_user_id;
  delete from public.follows where follower_id = v_user_id or seller_id = v_user_id;
  delete from public.app_alerts where user_id = v_user_id;
  delete from public.contact_reveal_events where user_id = v_user_id;
  delete from public.user_presence where user_id = v_user_id;
  delete from public.peek_request_supporters where user_id = v_user_id;
  delete from public.web_push_subscriptions where user_id = v_user_id;

  if to_regclass('public.email_notification_preferences') is not null then
    execute 'delete from public.email_notification_preferences where user_id = $1'
      using v_user_id;
  end if;

  update public.users
     set email = 'deleted-' || replace(v_user_id::text, '-', '') || '@deleted.invalid',
         full_name = 'Deleted user', phone = null, phone_verified = false,
         phone_otp_code = null, phone_otp_pending = null, phone_otp_expires = null,
         bio = null, avatar_url = null, verified = false, verified_at = null,
         verified_full_name = null, status = 'banned', ban_reason = 'Account deleted by user',
         ban_until = null, updated_at = now()
   where id = v_user_id;

  insert into public.account_deletion_receipts(user_id, requested_at, completed_at)
  values (v_user_id, now(), now())
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        completed_at = excluded.completed_at;

  return jsonb_build_object(
    'deleted', true,
    'user_id', v_user_id,
    'completed_at', now(),
    'retained_records_anonymised', true
  );
end;
$function$;

commit;
