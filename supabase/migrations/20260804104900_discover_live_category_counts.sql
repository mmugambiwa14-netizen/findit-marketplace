create or replace function public.discover_category_counts()
returns table(category_key text, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with listing_counts as (
    select c.marketplace_kind as category_key, count(*)::bigint as item_count
    from public.listings l
    join public.categories c
      on c.slug = l.category
     and c.marketplace_kind in ('property', 'car', 'machinery')
     and c.is_active = true
    where l.status in ('available'::public.listing_status, 'under_offer'::public.listing_status)
      and (l.expires_at is null or l.expires_at > now())
      and l.content_suspended_at is null
    group by c.marketplace_kind
  ), service_count as (
    select 'service'::text as category_key, count(*)::bigint as item_count
    from public.services s
    where s.status = 'active'::public.service_status
  ), keys(category_key) as (
    values ('property'::text), ('car'::text), ('machinery'::text), ('service'::text)
  )
  select k.category_key, coalesce(lc.item_count, sc.item_count, 0)::bigint
  from keys k
  left join listing_counts lc using (category_key)
  left join service_count sc using (category_key)
  order by case k.category_key
    when 'property' then 1
    when 'car' then 2
    when 'machinery' then 3
    else 4
  end;
$$;

revoke all on function public.discover_category_counts() from public;
grant execute on function public.discover_category_counts() to anon, authenticated;
