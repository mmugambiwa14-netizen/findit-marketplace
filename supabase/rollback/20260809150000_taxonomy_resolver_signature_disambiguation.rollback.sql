begin;

-- Emergency rollback restores the previous explicit compatibility overload.
create or replace function public.resolve_category_taxonomy(
  p_marketplace_kind text,
  p_slug text
)
returns table (
  category_id uuid,
  stable_slug text,
  canonical_slug text,
  is_postable boolean,
  superseded_by uuid,
  schema_binding jsonb
)
language sql
stable
set search_path to ''
as $function$
  select *
  from public.resolve_category_taxonomy(p_marketplace_kind, p_slug, null);
$function$;

revoke all on function public.resolve_category_taxonomy(text, text)
  from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text)
  to anon, authenticated;

commit;
