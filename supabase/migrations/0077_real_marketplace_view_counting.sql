create or replace function public.record_marketplace_view(
  p_parent_type text,
  p_parent_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_views bigint;
  v_viewer_id uuid := auth.uid();
begin
  if p_parent_type = 'listing' then
    update public.listings
    set views = coalesce(views, 0) + 1
    where id = p_parent_id
      and status in ('available', 'under_offer')
      and (v_viewer_id is null or seller_id <> v_viewer_id)
    returning views into v_views;

    if v_views is null then
      select coalesce(views, 0) into v_views
      from public.listings
      where id = p_parent_id
        and status in ('available', 'under_offer');
    end if;
  elsif p_parent_type = 'service' then
    update public.services
    set views = coalesce(views, 0) + 1
    where id = p_parent_id
      and status = 'active'
      and (v_viewer_id is null or provider_id <> v_viewer_id)
    returning views into v_views;

    if v_views is null then
      select coalesce(views, 0) into v_views
      from public.services
      where id = p_parent_id
        and status = 'active';
    end if;
  else
    raise exception 'unsupported marketplace parent type' using errcode = '22023';
  end if;

  return v_views;
end;
$$;

revoke all on function public.record_marketplace_view(text, uuid) from public;
grant execute on function public.record_marketplace_view(text, uuid) to anon, authenticated;

comment on function public.record_marketplace_view(text, uuid) is
  'Increments a visible marketplace item view through a trusted boundary; clients deduplicate per browser session and owner views are excluded.';
