-- Targeted rollback for 0040_v1_scale_hardening_and_observability.sql.
-- Disable Tours before applying. Data tables are preserved by default so an
-- operational incident does not destroy the evidence required for diagnosis.

drop trigger if exists trg_tour_report_metric on public.reports;
drop trigger if exists trg_tour_cache_metrics on public.tour_cache_invalidations;
drop trigger if exists trg_tour_cleanup_metrics_update on public.tour_asset_cleanup_queue;
drop trigger if exists trg_tour_cleanup_metrics_insert on public.tour_asset_cleanup_queue;
drop trigger if exists trg_listing_tours_processing_metrics on public.listing_tours;
drop trigger if exists trg_tour_upload_intent_metrics_update on public.listing_tour_upload_intents;
drop trigger if exists trg_tour_upload_intent_metrics_insert on public.listing_tour_upload_intents;

drop function if exists public.record_tour_report_metric();
drop function if exists public.record_tour_cache_metrics();
drop function if exists public.record_tour_cleanup_metrics();
drop function if exists public.record_tour_processing_metrics();
drop function if exists public.record_tour_upload_intent_metrics();

revoke all on function public.admin_operational_health(integer) from public, anon, authenticated;
revoke all on function public.evaluate_operational_alerts(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.prune_operational_metrics(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.record_operational_metric(text, numeric, text, integer, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.message_inbox_page(text, boolean, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.message_thread_page(uuid, timestamptz, uuid, integer) from public, anon, authenticated;

drop function if exists public.admin_operational_health(integer);
drop function if exists public.evaluate_operational_alerts(timestamptz);
drop function if exists public.prune_operational_metrics(timestamptz);
drop function if exists public.upsert_operational_alert(text, text, numeric, numeric, timestamptz, timestamptz, jsonb, boolean);
drop function if exists public.record_operational_metric(text, numeric, text, integer, jsonb, timestamptz);
drop function if exists public.message_inbox_page(text, boolean, timestamptz, uuid, integer);
drop function if exists public.message_thread_page(uuid, timestamptz, uuid, integer);

-- Preserve operational_metric_buckets and operational_alerts. They contain no
-- user content and may be required for incident reconstruction. A separately
-- reviewed retention operation may remove them after the incident is closed.

-- Restore the pre-0040 message functions without metric writes.
create or replace function public.start_listing_conversation(
  p_listing_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row public.listings%rowtype;
  conversation_row public.conversations%rowtype;
  body text := public.normalize_message_body(p_message);
  buyer_name text;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  select * into listing_row from public.listings
   where id = p_listing_id and status in ('available', 'under_offer') for share;
  if not found then raise exception 'listing is unavailable' using errcode = 'P0002'; end if;
  if listing_row.seller_id = auth.uid() then raise exception 'cannot message your own listing' using errcode = '22023'; end if;
  if not exists (select 1 from public.users where id = listing_row.seller_id and status = 'active') then
    raise exception 'seller is unavailable' using errcode = 'P0002';
  end if;
  select full_name into buyer_name from public.users where id = auth.uid();
  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (listing_row.id, auth.uid(), listing_row.seller_id)
  on conflict (listing_id, buyer_id) do update set updated_at = now()
  returning * into conversation_row;
  if conversation_row.state <> 'open' or conversation_row.buyer_blocked_at is not null
    or conversation_row.seller_blocked_at is not null or conversation_row.retention_until <= now() then
    raise exception 'conversation is unavailable' using errcode = '42501';
  end if;
  perform public.assert_message_rate_limit();
  insert into public.inquiries (
    listing_id, listing_title, seller_id, buyer_id, buyer_name,
    message, sender_id, conversation_id, status, attachments
  ) values (
    listing_row.id, listing_row.title, listing_row.seller_id, auth.uid(), buyer_name,
    body, auth.uid(), conversation_row.id, 'new', '[]'::jsonb
  );
  update public.conversations set last_message_at = now(), last_message_sender_id = auth.uid(),
    buyer_last_seen_at = now() where id = conversation_row.id;
  return conversation_row.id;
end;
$$;

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;
  listing_row public.listings%rowtype;
  body text := public.normalize_message_body(p_message);
  buyer_name text;
  message_id uuid;
begin
  if not public.is_active_user() then raise exception 'active account required' using errcode = '42501'; end if;
  select * into conversation_row from public.conversations
   where id = p_conversation_id and (buyer_id = auth.uid() or seller_id = auth.uid()) for update;
  if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
  if conversation_row.state <> 'open' or conversation_row.buyer_blocked_at is not null
    or conversation_row.seller_blocked_at is not null or conversation_row.retention_until <= now() then
    raise exception 'conversation is unavailable' using errcode = '42501';
  end if;
  select * into listing_row from public.listings where id = conversation_row.listing_id;
  if not found then raise exception 'listing context is unavailable' using errcode = 'P0002'; end if;
  select full_name into buyer_name from public.users where id = conversation_row.buyer_id;
  perform public.assert_message_rate_limit();
  insert into public.inquiries (
    listing_id, listing_title, seller_id, buyer_id, buyer_name,
    message, sender_id, conversation_id, status, attachments
  ) values (
    listing_row.id, listing_row.title, conversation_row.seller_id,
    conversation_row.buyer_id, buyer_name, body, auth.uid(),
    conversation_row.id, 'new', '[]'::jsonb
  ) returning id into message_id;
  update public.conversations set last_message_at = now(), last_message_sender_id = auth.uid(),
    buyer_last_seen_at = case when buyer_id = auth.uid() then now() else buyer_last_seen_at end,
    seller_last_seen_at = case when seller_id = auth.uid() then now() else seller_last_seen_at end
    where id = conversation_row.id;
  return message_id;
end;
$$;

revoke all on function public.start_listing_conversation(uuid, text) from public, anon;
revoke all on function public.send_conversation_message(uuid, text) from public, anon;
grant execute on function public.start_listing_conversation(uuid, text) to authenticated;
grant execute on function public.send_conversation_message(uuid, text) to authenticated;
