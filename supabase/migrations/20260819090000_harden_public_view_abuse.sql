-- Harden public marketplace and Peek view accounting.
--
-- The browser may still pass the historical p_viewer_key argument for API
-- compatibility, but the server now derives the subject from auth.uid() or
-- the gateway's connection address. The abuse ledger stores only a digest.

begin;

create or replace function private.request_abuse_subject(p_user_id uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_headers jsonb;
  v_ip text;
begin
  if p_user_id is not null then
    return 'user:' || p_user_id::text;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := coalesce(
    nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
    nullif(btrim(v_headers ->> 'x-real-ip'), ''),
    'anonymous'
  );
  return 'ip:' || v_ip;
end;
$function$;

revoke all on function private.request_abuse_subject(uuid) from public, anon, authenticated, service_role;

create or replace function private.record_marketplace_view(
  p_parent_type text,
  p_parent_id uuid
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_viewer_id uuid := auth.uid();
  v_subject text := private.request_abuse_subject(v_viewer_id);
  v_views bigint;
  v_owner_id uuid;
begin
  if p_parent_type = 'listing' then
    select coalesce(l.views, 0), l.seller_id
      into v_views, v_owner_id
    from public.listings l
    where l.id = p_parent_id
      and l.status in ('available', 'under_offer');
  elsif p_parent_type = 'service' then
    select coalesce(s.views, 0), s.provider_id
      into v_views, v_owner_id
    from public.services s
    where s.id = p_parent_id
      and s.status = 'active';
  else
    raise exception 'unsupported marketplace parent type' using errcode = '22023';
  end if;

  if v_views is null then return null; end if;
  if v_viewer_id is not null and v_owner_id = v_viewer_id then return v_views; end if;

  perform private.require_abuse_rate_limit(
    'marketplace.view.day', v_subject, 120, 86400,
    'marketplace view rate exceeded; try again later', '42900'
  );

  if p_parent_type = 'listing' then
    update public.listings
    set views = coalesce(views, 0) + 1
    where id = p_parent_id
      and status in ('available', 'under_offer');
  else
    update public.services
    set views = coalesce(views, 0) + 1
    where id = p_parent_id
      and status = 'active';
  end if;

  if not found then return v_views; end if;
  if p_parent_type = 'listing' then
    select coalesce(l.views, 0) into v_views from public.listings l where l.id = p_parent_id;
  else
    select coalesce(s.views, 0) into v_views from public.services s where s.id = p_parent_id;
  end if;
  return v_views;
end;
$function$;

revoke all on function private.record_marketplace_view(text, uuid) from public, anon, authenticated, service_role;
grant execute on function private.record_marketplace_view(text, uuid) to anon, authenticated, service_role;

create or replace function public.record_public_tour_view(p_tour_id uuid, p_viewer_key uuid)
returns table(recorded boolean, view_count bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_viewer_id uuid := auth.uid();
  v_subject text := private.request_abuse_subject(v_viewer_id);
  v_digest text;
  v_server_viewer_key uuid;
  v_inserted_count integer := 0;
begin
  if p_tour_id is null then
    raise exception 'invalid Peek view' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.listing_tours t
    where t.id = p_tour_id
      and t.status = 'ready'
      and t.moderation_status = 'approved'
      and t.deleted_at is null
      and t.removed_at is null
      and t.published_at is not null
      and public.is_tour_public_eligible(t.id)
  ) then
    raise exception 'Peek is unavailable' using errcode = 'P0002';
  end if;

  perform private.require_abuse_rate_limit(
    'peek.view.day', v_subject, 200, 86400,
    'Peek view rate exceeded; try again later', '42900'
  );

  -- Preserve a uuid-shaped dedup key for the existing event schema, but never
  -- trust the client-supplied p_viewer_key. The key is stable per subject,
  -- Peek and UTC day, so rotating local storage cannot inflate the count.
  v_digest := md5(v_subject || ':' || p_tour_id::text || ':' || current_date::text);
  v_server_viewer_key := (
    substr(v_digest, 1, 8) || '-' || substr(v_digest, 9, 4) || '-4' ||
    substr(v_digest, 14, 3) || '-8' || substr(v_digest, 18, 3) || '-' || substr(v_digest, 21, 12)
  )::uuid;

  insert into public.tour_view_events(tour_id, viewer_key, viewer_id)
  values (p_tour_id, v_server_viewer_key, v_viewer_id)
  on conflict (tour_id, viewer_key, viewed_on) do nothing;
  get diagnostics v_inserted_count = row_count;

  return query
  select v_inserted_count = 1,
         (select count(*)::bigint from public.tour_view_events v where v.tour_id = p_tour_id);
end;
$function$;

revoke all on function public.record_public_tour_view(uuid, uuid) from public;
grant execute on function public.record_public_tour_view(uuid, uuid) to anon, authenticated;

comment on function public.record_public_tour_view(uuid, uuid) is
  'Records at most one daily Peek view per server-derived authenticated user or gateway subject; the legacy client viewer key is ignored.';

commit;
