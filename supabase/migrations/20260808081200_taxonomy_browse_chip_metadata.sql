-- 20260808081200_taxonomy_browse_chip_metadata.sql
--
-- Keeps buyer browse chips concise without making React arrays a second
-- category authority. `schema_binding.ui.browse_chip_order` is presentation
-- metadata: only nodes carrying it appear as quick chips; full taxonomy remains
-- available through filters/search. Stable slugs and labels still come from the
-- canonical category row.

begin;

with featured(marketplace_kind, slug, browse_order) as (
  values
    ('property', 'house_sale', 10),
    ('property', 'apartment_rent', 20),
    ('property', 'bnb', 30),
    ('property', 'student_room', 40),
    ('property', 'office', 50),
    ('property', 'land_sale', 60),
    ('property', 'venue', 70),

    ('car', 'cars_sale', 10),
    ('car', 'minibus_kombi', 20),
    ('car', 'motorbike', 30),
    ('car', 'utility', 40),
    ('car', 'van', 50),
    ('car', 'luxury_classic', 60),
    ('car', 'spare_parts', 70),

    ('machinery', 'heavy_vehicles', 10),
    ('machinery', 'construction', 20),
    ('machinery', 'agricultural', 30),
    ('machinery', 'mining', 40),
    ('machinery', 'material_handling', 50),
    ('machinery', 'generators', 60),
    ('machinery', 'lifting', 70),
    ('machinery', 'boats', 80),

    ('service', 'property_developer', 10),
    ('service', 'mechanic', 20),
    ('service', 'construction', 30),
    ('service', 'geological', 40)
)
update public.categories c
set schema_binding = c.schema_binding || jsonb_build_object(
      'ui',
      coalesce(c.schema_binding -> 'ui', '{}'::jsonb)
        || jsonb_build_object('browse_chip_order', featured.browse_order)
    ),
    taxonomy_version = c.taxonomy_version + 1
from featured
where c.marketplace_kind = featured.marketplace_kind
  and c.slug = featured.slug;

do $verify$
declare
  expected integer := 27;
  actual integer;
begin
  select count(*)::integer into actual
  from public.categories
  where schema_binding #> '{ui,browse_chip_order}' is not null;

  if actual < expected then
    raise exception 'expected at least % featured taxonomy browse chips, found %', expected, actual;
  end if;

  if exists (
    select 1
    from public.categories
    where schema_binding #> '{ui,browse_chip_order}' is not null
      and (
        not is_active
        or superseded_by is not null
        or (
          marketplace_kind <> 'service'
          and (node_type <> 'category' or not is_postable)
        )
      )
  ) then
    raise exception 'browse chip metadata points at an unavailable taxonomy node';
  end if;
end;
$verify$;

commit;
