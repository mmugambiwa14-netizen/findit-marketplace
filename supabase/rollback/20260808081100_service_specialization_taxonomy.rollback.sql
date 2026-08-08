-- 20260808081100_service_specialization_taxonomy.rollback.sql
-- Safety rollback: the migration promotes existing durable service-specialization
-- slugs into canonical taxonomy nodes. Removing them after services reference
-- those stable keys would discard classification meaning. Preserve the nodes and
-- reassert the domain/specialization contract instead of deleting taxonomy data.

begin;

update public.categories
set node_type = 'group',
    is_postable = false
where marketplace_kind = 'service'
  and slug in ('property_developer', 'mechanic', 'construction', 'geological');

do $rollback$
begin
  if exists (
    select 1
    from public.categories
    where marketplace_kind = 'service'
      and slug in ('property_developer', 'mechanic', 'construction', 'geological')
      and (node_type <> 'group' or is_postable)
  ) then
    raise exception 'service taxonomy rollback lost domain-group semantics';
  end if;

  if not exists (
    select 1
    from public.categories
    where marketplace_kind = 'service'
      and slug = 'pre_purchase_inspection'
      and node_type = 'category'
      and is_postable
  ) then
    raise exception 'service taxonomy rollback would remove durable specialization nodes';
  end if;
end;
$rollback$;

commit;
