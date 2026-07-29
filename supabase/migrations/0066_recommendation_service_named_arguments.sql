-- 0066_recommendation_service_named_arguments.sql
-- Give the five subject-scoped recommendation services named parameters.
--
-- 0059 created them with anonymous parameters, so they are only callable with
-- positional syntax. The Edge Function runtime reaches them over PostgREST, which
-- resolves RPC arguments by name and therefore could never match them: every
-- request failed and fell through to the fail-soft empty payload. 0060 already
-- corrected the two global services this way; this migration finishes the set.
--
-- The functions must be dropped rather than replaced, because a parameter name
-- cannot be introduced by "create or replace". They are consequently new
-- functions, so the 0027 execute boundary is restated below.

drop function if exists public.similar_listings_service_v1(uuid, text, integer);
drop function if exists public.seller_recommendations_service_v1(uuid, text, integer);
drop function if exists public.related_services_service_v1(uuid, text, integer);
drop function if exists public.related_products_service_v1(uuid, text, integer);
drop function if exists public.nearby_service_v1(uuid, text, integer, integer);

create function public.similar_listings_service_v1(
  p_subject_listing_id uuid,
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('similar_listings_service', p_subject_listing_id, null, p_cursor, p_limit, 50000); $$;

create function public.seller_recommendations_service_v1(
  p_subject_listing_id uuid,
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('seller_recommendations_service', p_subject_listing_id, null, p_cursor, p_limit, 50000); $$;

create function public.related_services_service_v1(
  p_subject_listing_id uuid,
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('related_services_service', p_subject_listing_id, null, p_cursor, p_limit, 50000); $$;

create function public.related_products_service_v1(
  p_subject_listing_id uuid,
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('related_products_service', p_subject_listing_id, null, p_cursor, p_limit, 50000); $$;

create function public.nearby_service_v1(
  p_subject_listing_id uuid,
  p_cursor text default null,
  p_limit integer default 12,
  p_max_distance_meters integer default 50000
)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('nearby_service', p_subject_listing_id, null, p_cursor, p_limit, p_max_distance_meters); $$;

-- Supabase default privileges grant execute on every new public-schema function to
-- anon and authenticated. These services are service-role only, so restate 0027.
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
    'schema_version', 66,
    'service_arguments_named', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.similar_listings_service_v1(uuid, text, integer)
  is 'Subject-scoped similar listings service. Named arguments so the Edge runtime can reach it over PostgREST.';
comment on function public.nearby_service_v1(uuid, text, integer, integer)
  is 'Subject-scoped nearby listings service. Named arguments so the Edge runtime can reach it over PostgREST.';
