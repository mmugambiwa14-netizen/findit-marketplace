-- 0071_privacy_preserving_personalization.sql
-- Phase 5: explicit owner-controlled personalization with bounded first-party
-- signals, immediate opt-out, and account-linked recommendation data deletion.

create table if not exists public.recommendation_personalization_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consent_version integer not null default 1 check (consent_version > 0),
  enabled_at timestamptz,
  disabled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (enabled and enabled_at is not null)
    or (not enabled)
  )
);

alter table public.recommendation_personalization_preferences enable row level security;
alter table public.recommendation_personalization_preferences force row level security;
revoke all on public.recommendation_personalization_preferences from public, anon, authenticated;
grant select on public.recommendation_personalization_preferences to authenticated;

create policy recommendation_personalization_preferences_owner_read
  on public.recommendation_personalization_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create trigger trg_recommendation_personalization_preferences_updated_at
  before update on public.recommendation_personalization_preferences
  for each row execute function public.set_updated_at();

create or replace function public.get_my_recommendation_personalization_v1()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'contractVersion', 1,
    'enabled', coalesce(preference.enabled, false),
    'consentVersion', coalesce(preference.consent_version, 1),
    'enabledAt', preference.enabled_at,
    'disabledAt', preference.disabled_at,
    'updatedAt', preference.updated_at
  )
  from (select auth.uid() as user_id) viewer
  left join public.recommendation_personalization_preferences preference
    on preference.user_id = viewer.user_id
  where viewer.user_id is not null;
$$;

create or replace function public.set_my_recommendation_personalization_v1(
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  preference public.recommendation_personalization_preferences%rowtype;
begin
  if viewer_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'personalization preference is required' using errcode = '22023';
  end if;
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  insert into public.recommendation_personalization_preferences as current (
    user_id,
    enabled,
    consent_version,
    enabled_at,
    disabled_at
  )
  values (
    viewer_id,
    p_enabled,
    1,
    case when p_enabled then now() else null end,
    case when p_enabled then null else now() end
  )
  on conflict (user_id) do update set
    enabled = excluded.enabled,
    consent_version = excluded.consent_version,
    enabled_at = case
      when excluded.enabled and not current.enabled then now()
      when excluded.enabled then current.enabled_at
      else current.enabled_at
    end,
    disabled_at = case when excluded.enabled then null else now() end
  returning * into preference;

  return jsonb_build_object(
    'contractVersion', 1,
    'enabled', preference.enabled,
    'consentVersion', preference.consent_version,
    'enabledAt', preference.enabled_at,
    'disabledAt', preference.disabled_at,
    'updatedAt', preference.updated_at
  );
end;
$$;

create or replace function public.clear_my_recommendation_personalization_data_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  removed_events integer := 0;
begin
  if viewer_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  with removed as (
    delete from public.recommendation_events event
    where event.actor_id = viewer_id
    returning event.id
  )
  select count(*) into removed_events from removed;

  insert into public.recommendation_personalization_preferences (
    user_id,
    enabled,
    consent_version,
    enabled_at,
    disabled_at
  )
  values (viewer_id, false, 1, null, now())
  on conflict (user_id) do update set
    enabled = false,
    disabled_at = now();

  return jsonb_build_object(
    'contractVersion', 1,
    'cleared', true,
    'removedEvents', removed_events,
    'personalizationEnabled', false
  );
end;
$$;

create or replace function public.personalized_recommendation_service_v1(
  p_viewer_id uuid,
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_row public.recommendation_service_policies%rowtype;
  preference_row public.recommendation_personalization_preferences%rowtype;
  cursor_value jsonb;
  cursor_score numeric;
  cursor_published_at timestamptz;
  cursor_listing_id uuid;
  bounded_limit integer;
  request_id uuid := gen_random_uuid();
  result_items jsonb;
  has_more boolean;
  next_cursor text;
begin
  if p_viewer_id is null then
    raise exception 'viewer is required' using errcode = '22023';
  end if;

  select * into policy_row
  from public.recommendation_service_policies
  where service_name = 'personalized_recommendation_service';

  bounded_limit := greatest(1, least(coalesce(p_limit, 12), policy_row.maximum_page_size));
  if not policy_row.enabled then
    return jsonb_build_object(
      'contractVersion', policy_row.contract_version,
      'service', policy_row.service_name,
      'requestId', request_id,
      'items', '[]'::jsonb,
      'nextCursor', null,
      'degraded', true,
      'reason', 'service_disabled'
    );
  end if;

  select * into preference_row
  from public.recommendation_personalization_preferences
  where user_id = p_viewer_id
    and enabled;

  if not found then
    return jsonb_build_object(
      'contractVersion', policy_row.contract_version,
      'service', policy_row.service_name,
      'requestId', request_id,
      'items', '[]'::jsonb,
      'nextCursor', null,
      'degraded', false,
      'reason', 'personalization_not_enabled'
    );
  end if;

  if p_cursor is not null then
    cursor_value := public.decode_recommendation_cursor_v1(p_cursor);
    cursor_score := (cursor_value ->> 'score')::numeric;
    cursor_published_at := (cursor_value ->> 'published_at')::timestamptz;
    cursor_listing_id := (cursor_value ->> 'listing_id')::uuid;
  end if;

  with affinity as (
    select feature.category_key, count(*)::numeric as interactions
    from public.recommendation_events event
    join public.eligible_listing_recommendation_features feature
      on feature.listing_id = event.listing_id
    where event.actor_id = p_viewer_id
      and event.occurred_at >= greatest(
        coalesce(preference_row.enabled_at, now()),
        now() - interval '90 days'
      )
      and event.event_type in (
        'view',
        'save',
        'tour_watch',
        'chat_start',
        'recommendation_click'
      )
    group by feature.category_key
  ),
  ranked as (
    select
      feature.*,
      (affinity.interactions + feature.quality_score + feature.freshness_score
        + least(feature.popularity_score, 10) / 10)::numeric as rank_score
    from public.eligible_listing_recommendation_features feature
    join affinity on affinity.category_key = feature.category_key
  ),
  page as (
    select *
    from ranked
    where p_cursor is null
       or (rank_score, published_at, listing_id) <
          (cursor_score, cursor_published_at, cursor_listing_id)
    order by rank_score desc, published_at desc nulls last, listing_id desc
    limit bounded_limit + 1
  ),
  visible_page as (
    select * from page
    order by rank_score desc, published_at desc nulls last, listing_id desc
    limit bounded_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'listingId', listing_id,
      'sellerId', seller_id,
      'categoryKey', category_key,
      'subcategoryKey', subcategory_key,
      'countryCode', country_code,
      'locationKey', location_key,
      'priceAmount', price_amount,
      'currency', currency,
      'publishedAt', published_at,
      'score', round(rank_score, 6),
      'reasonCode', 'category_affinity'
    ) order by rank_score desc, published_at desc nulls last, listing_id desc), '[]'::jsonb),
    (select count(*) > bounded_limit from page),
    (select public.encode_recommendation_cursor_v1(rank_score, published_at, listing_id)
       from visible_page
       order by rank_score asc, published_at asc nulls first, listing_id asc
       limit 1)
  into result_items, has_more, next_cursor
  from visible_page;

  if not has_more then next_cursor := null; end if;
  return jsonb_build_object(
    'contractVersion', policy_row.contract_version,
    'service', policy_row.service_name,
    'requestId', request_id,
    'items', result_items,
    'nextCursor', next_cursor,
    'degraded', false
  );
end;
$$;

revoke all on function public.get_my_recommendation_personalization_v1()
  from public, anon, authenticated;
revoke all on function public.set_my_recommendation_personalization_v1(boolean)
  from public, anon, authenticated;
revoke all on function public.clear_my_recommendation_personalization_data_v1()
  from public, anon, authenticated;
revoke all on function public.personalized_recommendation_service_v1(uuid, text, integer)
  from public, anon, authenticated;

grant execute on function public.get_my_recommendation_personalization_v1()
  to service_role, authenticated;
grant execute on function public.set_my_recommendation_personalization_v1(boolean)
  to service_role, authenticated;
grant execute on function public.clear_my_recommendation_personalization_data_v1()
  to service_role, authenticated;
grant execute on function public.personalized_recommendation_service_v1(uuid, text, integer)
  to service_role;

update public.marketplace_operational_controls
set
  state = 'phase_5_privacy_preserving_personalization',
  configuration = configuration || jsonb_build_object(
    'schema_version', 71,
    'personalization_default_enabled', false,
    'personalization_requires_explicit_consent', true,
    'personalization_signal_window_days', 90,
    'personalization_message_content_used', false,
    'personalization_contact_data_used', false,
    'personalization_owner_clear_supported', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on table public.recommendation_personalization_preferences
  is 'Owner-controlled, default-off consent boundary for account-linked recommendation ranking.';
comment on function public.clear_my_recommendation_personalization_data_v1()
  is 'Deletes the caller account-linked recommendation event history and disables personalization.';
comment on function public.personalized_recommendation_service_v1(uuid, text, integer)
  is 'Consent-gated first-party personalization using only bounded listing interaction events recorded after opt-in.';
