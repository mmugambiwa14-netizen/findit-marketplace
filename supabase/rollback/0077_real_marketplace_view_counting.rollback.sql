revoke all on function public.record_marketplace_view(text, uuid)
  from public, anon, authenticated, service_role;

drop function if exists public.record_marketplace_view(text, uuid);
