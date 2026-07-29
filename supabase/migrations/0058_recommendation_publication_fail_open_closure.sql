-- 0058_recommendation_publication_fail_open_closure.sql
-- Defense in depth for recommendation publication eligibility.

create or replace view public.eligible_listing_recommendation_features
with (security_barrier = true, security_invoker = true)
as
select feature.*
from public.listing_recommendation_features feature
join public.listings listing
  on listing.id = feature.listing_id
 and listing.status in ('available', 'under_offer')
 and listing.content_suspended_at is null
join public.users seller
  on seller.id = feature.seller_id
 and seller.status = 'active';

revoke all on public.eligible_listing_recommendation_features
  from public, anon, authenticated;
grant select on public.eligible_listing_recommendation_features
  to service_role;

create or replace function public.sync_listing_recommendation_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    begin
      delete from public.listing_recommendation_features where listing_id = old.id;
      delete from public.recommendation_projection_jobs where listing_id = old.id;
    exception when others then
      null;
    end;
    return old;
  end if;

  if new.status not in ('available', 'under_offer')
    or new.content_suspended_at is not null
  then
    begin
      delete from public.listing_recommendation_features where listing_id = new.id;
      perform public.enqueue_listing_recommendation_projection(new.id);
    exception when others then
      -- Listing publication and moderation state remains authoritative even if
      -- recommendation cleanup or queueing is temporarily unavailable.
      null;
    end;
    return new;
  end if;

  begin
    perform public.enqueue_listing_recommendation_projection(new.id);
  exception when others then
    null;
  end;

  return new;
end;
$$;

revoke all on function public.sync_listing_recommendation_feature()
  from public, anon, authenticated;

create or replace function public.validate_recommendation_event_subject_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  eligible_seller_id uuid;
begin
  if new.actor_id is not null and not exists (
    select 1
    from public.users actor
    where actor.id = new.actor_id
      and actor.status = 'active'
  ) then
    raise exception 'event actor is not active'
      using errcode = '42501';
  end if;

  if new.listing_id is not null then
    select listing.seller_id
    into eligible_seller_id
    from public.listings listing
    join public.users seller
      on seller.id = listing.seller_id
     and seller.status = 'active'
    where listing.id = new.listing_id
      and listing.status in ('available', 'under_offer')
      and listing.content_suspended_at is null;

    if not found or new.seller_id is distinct from eligible_seller_id then
      raise exception 'event subject is not publicly eligible'
        using errcode = '22023';
    end if;
  elsif new.event_type = 'seller_follow' then
    if new.seller_id is null or not exists (
      select 1
      from public.users seller
      where seller.id = new.seller_id
        and seller.status = 'active'
    ) then
      raise exception 'event subject is not publicly eligible'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_recommendation_event_subject_state()
  from public, anon, authenticated;

update public.marketplace_operational_controls
set
  state = 'phase_1_publication_closed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 58,
    'service_eligibility_view', 'eligible_listing_recommendation_features',
    'immediate_non_public_cleanup', true,
    'active_event_actor_required', true,
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on view public.eligible_listing_recommendation_features
  is 'Mandatory service-only projection boundary. It rechecks current listing publication, content suspension and seller status so stale rows cannot become recommendations.';
comment on function public.sync_listing_recommendation_feature()
  is 'Fail-open queue trigger with immediate best-effort removal for non-public or suspended listings. Core listing writes never depend on recommendation availability.';
