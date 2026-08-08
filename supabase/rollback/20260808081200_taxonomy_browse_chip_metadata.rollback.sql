-- 20260808081200_taxonomy_browse_chip_metadata.rollback.sql
-- Presentation metadata is additive and does not alter stable taxonomy identity.
-- Preserve it during rollback so buyer browse remains driven by canonical
-- taxonomy rather than falling back to stale client arrays.

begin;

do $rollback$
begin
  if not exists (
    select 1
    from public.categories
    where schema_binding #> '{ui,browse_chip_order}' is not null
  ) then
    raise exception 'taxonomy browse metadata is unexpectedly absent';
  end if;
end;
$rollback$;

commit;
