begin;

drop trigger if exists listings_auto_publish_validated_mvp on public.listings;
drop function if exists private.auto_publish_validated_mvp_listing();

-- Restore the pre-MVP owner transition contract. New and relisted listings
-- return to pending_review until a trusted moderation action publishes them.
create or replace function public.owner_transition_listing(
  p_listing_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row public.listings%rowtype;
  next_status public.listing_status;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_action not in ('submit', 'pause', 'resume', 'unavailable') then
    raise exception 'invalid owner listing action' using errcode = '22023';
  end if;
  select * into listing_row from public.listings
  where id = p_listing_id and seller_id = auth.uid() for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;

  if p_action = 'submit' and listing_row.status in ('draft', 'rejected', 'expired', 'unavailable') then
    if not exists (select 1 from public.listing_media where listing_id = p_listing_id) then
      raise exception 'at least one validated image is required' using errcode = '22023';
    end if;
    next_status := 'pending_review';
  elsif p_action = 'pause' and listing_row.status in ('available', 'under_offer', 'rented') then
    next_status := 'paused';
  elsif p_action = 'resume' and listing_row.status = 'paused' then
    next_status := 'available';
  elsif p_action = 'unavailable' and listing_row.status in ('available', 'under_offer', 'rented', 'paused') then
    next_status := 'unavailable';
  else
    raise exception 'listing action is not allowed from the current status' using errcode = '22023';
  end if;

  update public.listings
  set status = next_status,
      submitted_at = case when next_status = 'pending_review' then now() else submitted_at end,
      moderation_reason = case when next_status = 'pending_review' then null else moderation_reason end,
      expires_at = case when next_status = 'pending_review' then null else expires_at end,
      expiry_notice_sent_at = case when next_status = 'pending_review' then null else expiry_notice_sent_at end
  where id = p_listing_id
  returning * into listing_row;
  return jsonb_build_object('id', listing_row.id, 'kind', listing_row.kind, 'status', listing_row.status);
end;
$$;

create or replace function public.protect_listing_managed_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.seller_id and not public.is_admin() and current_user not in ('postgres', 'service_role') then
    if new.id is distinct from old.id
      or new.kind is distinct from old.kind
      or new.seller_id is distinct from old.seller_id
      or new.status is distinct from old.status
      or new.verified is distinct from old.verified
      or new.views is distinct from old.views
      or new.created_via is distinct from old.created_via
      or new.created_at is distinct from old.created_at
      or new.submission_key is distinct from old.submission_key
      or new.submitted_at is distinct from old.submitted_at
      or new.moderation_reason is distinct from old.moderation_reason
      or new.expires_at is distinct from old.expires_at
      or new.expiry_notice_sent_at is distinct from old.expiry_notice_sent_at
    then
      raise exception 'listing-managed fields require a trusted operation' using errcode = '42501';
    end if;
    if old.status in ('available', 'under_offer', 'rented', 'paused') and (
      new.seller_name is distinct from old.seller_name
      or new.contact_phone is distinct from old.contact_phone
      or new.contact_whatsapp is distinct from old.contact_whatsapp
      or new.contact_email is distinct from old.contact_email
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.price is distinct from old.price
      or new.currency is distinct from old.currency
      or new.accepts_offers is distinct from old.accepts_offers
      or new.photos is distinct from old.photos
      or new.location_id is distinct from old.location_id
      or new.category is distinct from old.category
      or new.listing_type is distinct from old.listing_type
    ) then
      new.status := 'pending_review';
      new.submitted_at := now();
      new.moderation_reason := null;
      new.expires_at := null;
      new.expiry_notice_sent_at := null;
    end if;
  end if;
  return new;
end;
$$;

commit;
