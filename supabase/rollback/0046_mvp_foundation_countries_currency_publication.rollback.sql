-- Non-destructive rollback for the MVP foundation country/currency/publication layer.
--
-- This intentionally does not remove tables, columns, enum values, indexes or
-- captured location data from 0046. PostgreSQL enum values cannot be safely
-- removed in-place, and dropping columns would destroy marketplace evidence.
-- The rollback narrows the runtime write path by restoring the owner submit
-- transition to the pre-0046 pending-review state. Existing published rows are
-- preserved for manual incident handling.

create or replace function public.owner_transition_listing(
  p_listing_id uuid,
  p_action text
)
returns jsonb as $$
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
$$ language plpgsql security definer set search_path = public;

update public.marketplace_operational_controls
set enabled = false,
    updated_at = now(),
    updated_by = null
where control_name in (
  'international_listing',
  'maps',
  'currency_conversion',
  'phone_verification',
  'listing_expiry'
);
