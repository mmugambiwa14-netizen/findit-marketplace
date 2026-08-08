-- 20260808080000_canonical_taxonomy_foundation.rollback.sql
--
-- Safety rollback. The migration adds lifecycle metadata and, critically,
-- replaces the unsafe assumption that every non-root category is postable with
-- an explicit postability boundary. Removing those columns or that trigger
-- would either discard taxonomy history or knowingly reintroduce the category
-- authorization defect. The rollback therefore preserves data and the stricter
-- boundary, while reasserting the intended public/admin privilege surface.

begin;

-- Public taxonomy reads remain read-only and available to marketplace clients.
revoke all on function public.public_category_taxonomy(text) from public;
grant execute on function public.public_category_taxonomy(text) to anon, authenticated;

revoke all on function public.resolve_category_taxonomy(text, text) from public;
grant execute on function public.resolve_category_taxonomy(text, text) to anon, authenticated;

-- Taxonomy administration remains authenticated-entry/admin-authorized. The
-- SECURITY DEFINER functions perform their own require_admin_reason/is_admin
-- checks; anon never receives execute privilege.
revoke all on function public.admin_taxonomy_rows() from public, anon;
grant execute on function public.admin_taxonomy_rows() to authenticated;

revoke all on function public.admin_add_taxonomy_node(uuid, text, text, text, text, boolean, integer, jsonb, text[], text[], text)
  from public, anon;
grant execute on function public.admin_add_taxonomy_node(uuid, text, text, text, text, boolean, integer, jsonb, text[], text[], text)
  to authenticated;

revoke all on function public.admin_update_taxonomy_node(uuid, text, text, integer, boolean, boolean, text[], text[], uuid, timestamptz, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_taxonomy_node(uuid, text, text, integer, boolean, boolean, text[], text[], uuid, timestamptz, jsonb, text)
  to authenticated;

-- Keep explicit postability enforcement in place. Tree depth must never become
-- an authorization rule again.
drop trigger if exists trg_listings_taxonomy_category on public.listings;
create trigger trg_listings_taxonomy_category
  before insert or update of kind, category on public.listings
  for each row execute function public.enforce_listing_taxonomy_category();

do $rollback$
begin
  if exists (
    select 1 from public.categories
    where parent_id is null and (node_type <> 'group' or is_postable)
  ) then
    raise exception 'rollback would leave a marketplace root postable';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.listings'::regclass
      and tgname = 'trg_listings_taxonomy_category'
      and not tgisinternal
  ) then
    raise exception 'rollback lost explicit listing taxonomy enforcement';
  end if;

  if has_function_privilege('anon', 'public.admin_taxonomy_rows()', 'EXECUTE') then
    raise exception 'rollback exposed taxonomy administration to anon';
  end if;
end;
$rollback$;

commit;
