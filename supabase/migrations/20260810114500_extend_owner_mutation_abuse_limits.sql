-- 20260810114500_extend_owner_mutation_abuse_limits.sql
-- Extends the existing private token-bucket limiter to owner-controlled writes
-- that were not covered by the original abuse-budget rollout. These triggers
-- are deliberately actor-aware: service-role/admin/background writes and
-- passive counters are not throttled as if they were seller edits.

begin;

create or replace function private.enforce_listing_owner_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_changed boolean := false;
begin
  if v_actor is null or new.seller_id is distinct from v_actor then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform private.require_abuse_rate_limit(
      'listing.create.10m', v_actor::text, 30, 600,
      'listing creation rate limit exceeded; try again shortly', '42900'
    );
    perform private.require_abuse_rate_limit(
      'listing.create.day', v_actor::text, 500, 86400,
      'daily listing creation limit exceeded', '42900'
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_changed := (to_jsonb(new) - 'views' - 'updated_at')
      is distinct from (to_jsonb(old) - 'views' - 'updated_at');
    if v_changed then
      perform private.require_abuse_rate_limit(
        'listing.edit.10m', v_actor::text, 120, 600,
        'listing update rate limit exceeded; try again shortly', '42900'
      );
      perform private.require_abuse_rate_limit(
        'listing.edit.day', v_actor::text, 2000, 86400,
        'daily listing update limit exceeded', '42900'
      );
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_service_owner_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_changed boolean := false;
begin
  if v_actor is null or new.provider_id is distinct from v_actor then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform private.require_abuse_rate_limit(
      'service.create.10m', v_actor::text, 20, 600,
      'service creation rate limit exceeded; try again shortly', '42900'
    );
    perform private.require_abuse_rate_limit(
      'service.create.day', v_actor::text, 200, 86400,
      'daily service creation limit exceeded', '42900'
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_changed := (to_jsonb(new) - 'views' - 'updated_at')
      is distinct from (to_jsonb(old) - 'views' - 'updated_at');
    if v_changed then
      perform private.require_abuse_rate_limit(
        'service.edit.10m', v_actor::text, 60, 600,
        'service update rate limit exceeded; try again shortly', '42900'
      );
      perform private.require_abuse_rate_limit(
        'service.edit.day', v_actor::text, 1000, 86400,
        'daily service update limit exceeded', '42900'
      );
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_peek_support_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or new.user_id is distinct from v_actor then
    return new;
  end if;

  perform private.require_abuse_rate_limit(
    'peek_support.10m', v_actor::text, 30, 600,
    'Peek Request support rate limit exceeded; try again shortly', '42900'
  );
  perform private.require_abuse_rate_limit(
    'peek_support.day', v_actor::text, 300, 86400,
    'daily Peek Request support limit exceeded', '42900'
  );
  return new;
end;
$function$;

create or replace function private.enforce_profile_owner_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_changed boolean := false;
begin
  if v_actor is null or new.id is distinct from v_actor then
    return new;
  end if;

  v_changed := (to_jsonb(new) - 'updated_at')
    is distinct from (to_jsonb(old) - 'updated_at');
  if v_changed then
    perform private.require_abuse_rate_limit(
      'profile.edit.hour', v_actor::text, 30, 3600,
      'profile update rate limit exceeded; try again later', '42900'
    );
    perform private.require_abuse_rate_limit(
      'profile.edit.day', v_actor::text, 200, 86400,
      'daily profile update limit exceeded', '42900'
    );
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_listing_owner_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_service_owner_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_peek_support_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_profile_owner_abuse_budget() from public, anon, authenticated, service_role;

drop trigger if exists trg_listings_owner_abuse_budget on public.listings;
create trigger trg_listings_owner_abuse_budget
  before insert or update on public.listings
  for each row execute function private.enforce_listing_owner_abuse_budget();

drop trigger if exists trg_services_owner_abuse_budget on public.services;
create trigger trg_services_owner_abuse_budget
  before insert or update on public.services
  for each row execute function private.enforce_service_owner_abuse_budget();

drop trigger if exists trg_peek_request_supporters_abuse_budget on public.peek_request_supporters;
create trigger trg_peek_request_supporters_abuse_budget
  before insert on public.peek_request_supporters
  for each row execute function private.enforce_peek_support_abuse_budget();

drop trigger if exists trg_users_owner_abuse_budget on public.users;
create trigger trg_users_owner_abuse_budget
  before update on public.users
  for each row execute function private.enforce_profile_owner_abuse_budget();

commit;
