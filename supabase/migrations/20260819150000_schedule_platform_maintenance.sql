-- Bounded platform maintenance orchestration.
-- The individual operations remain service-role-only; this wrapper only makes
-- the single-row dead-letter retry primitive safe to run as a batch job.

create or replace function public.retry_recommendation_projection_dead_letters(
  p_limit integer default 100
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_retried integer := 0;
  v_dead_letter record;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 500 then
    raise exception 'invalid retry limit' using errcode = '22023';
  end if;

  for v_dead_letter in
    select d.id
    from public.recommendation_projection_dead_letters d
    where d.retried_at is null
    order by d.failed_at, d.id
    limit p_limit
    for update skip locked
  loop
    if public.retry_recommendation_projection_dead_letter(v_dead_letter.id) then
      v_retried := v_retried + 1;
    end if;
  end loop;

  return v_retried;
end;
$$;

revoke all on function public.retry_recommendation_projection_dead_letters(integer)
  from public, anon, authenticated;
grant execute on function public.retry_recommendation_projection_dead_letters(integer)
  to service_role;

comment on function public.retry_recommendation_projection_dead_letters(integer)
  is 'Bounded service-only retry worker for unretried recommendation projection dead letters.';
