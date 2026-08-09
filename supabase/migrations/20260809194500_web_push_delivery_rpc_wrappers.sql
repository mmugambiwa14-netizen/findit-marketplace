begin;

create or replace function public.claim_web_push_deliveries(p_limit integer default 25)
returns table(
  delivery_id bigint,
  lease_token uuid,
  notification_id uuid,
  user_id uuid,
  event_type text,
  title text,
  body text,
  link text,
  created_at timestamptz,
  subscriptions jsonb
)
language sql
security definer
set search_path = ''
as $wrapper$
  select * from private.claim_web_push_deliveries($1);
$wrapper$;

create or replace function public.complete_web_push_delivery(
  p_delivery_id bigint,
  p_lease_token uuid,
  p_delivered boolean,
  p_error text default null
)
returns void
language sql
security definer
set search_path = ''
as $wrapper$
  select private.complete_web_push_delivery($1,$2,$3,$4);
$wrapper$;

create or replace function public.record_web_push_subscription_result(
  p_subscription_id uuid,
  p_success boolean,
  p_permanent_failure boolean default false
)
returns void
language sql
security definer
set search_path = ''
as $wrapper$
  select private.record_web_push_subscription_result($1,$2,$3);
$wrapper$;

revoke all on function public.claim_web_push_deliveries(integer) from public, anon, authenticated;
revoke all on function public.complete_web_push_delivery(bigint,uuid,boolean,text) from public, anon, authenticated;
revoke all on function public.record_web_push_subscription_result(uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function public.claim_web_push_deliveries(integer) to service_role;
grant execute on function public.complete_web_push_delivery(bigint,uuid,boolean,text) to service_role;
grant execute on function public.record_web_push_subscription_result(uuid,boolean,boolean) to service_role;

commit;
