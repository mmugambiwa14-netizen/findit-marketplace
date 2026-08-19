-- Remove only the bounded orchestration wrapper. The underlying maintenance
-- primitives remain intact because they are part of their owning migrations.
revoke all on function public.retry_recommendation_projection_dead_letters(integer)
  from public, anon, authenticated, service_role;

drop function if exists public.retry_recommendation_projection_dead_letters(integer);
