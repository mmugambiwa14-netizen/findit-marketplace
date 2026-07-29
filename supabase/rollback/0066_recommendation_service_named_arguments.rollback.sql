-- 0066_recommendation_service_named_arguments.rollback.sql
-- Restore the anonymous-parameter service signatures created by 0059.
--
-- Non-destructive: only function definitions are replaced. No table, row or audit
-- record is removed. Reverting reinstates the pre-0066 behaviour, in which the
-- services are reachable positionally but not by name over PostgREST.

drop function if exists public.similar_listings_service_v1(uuid, text, integer);
drop function if exists public.seller_recommendations_service_v1(uuid, text, integer);
drop function if exists public.related_services_service_v1(uuid, text, integer);
drop function if exists public.related_products_service_v1(uuid, text, integer);
drop function if exists public.nearby_service_v1(uuid, text, integer, integer);

create function public.similar_listings_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('similar_listings_service', $1, null, $2, $3, 50000); $$;

create function public.seller_recommendations_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('seller_recommendations_service', $1, null, $2, $3, 50000); $$;

create function public.related_services_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('related_services_service', $1, null, $2, $3, 50000); $$;

create function public.related_products_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('related_products_service', $1, null, $2, $3, 50000); $$;

create function public.nearby_service_v1(uuid, text default null, integer default 12, integer default 50000)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('nearby_service', $1, null, $2, $3, $4); $$;

revoke all on function public.similar_listings_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.seller_recommendations_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.related_services_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.related_products_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.nearby_service_v1(uuid, text, integer, integer) from public, anon, authenticated;

grant execute on function public.similar_listings_service_v1(uuid, text, integer) to service_role;
grant execute on function public.seller_recommendations_service_v1(uuid, text, integer) to service_role;
grant execute on function public.related_services_service_v1(uuid, text, integer) to service_role;
grant execute on function public.related_products_service_v1(uuid, text, integer) to service_role;
grant execute on function public.nearby_service_v1(uuid, text, integer, integer) to service_role;

update public.marketplace_operational_controls
set
  configuration = configuration || jsonb_build_object(
    'schema_version', 65,
    'service_arguments_named', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
