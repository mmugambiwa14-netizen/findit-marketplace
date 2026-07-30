-- Rollback for 0092_zimbabwe_province_hierarchy.sql.
--
-- Non-destructive by policy: scripts/verify-sql-boundary.mjs rejects removal
-- statements in any rollback at or above 0040. Seeded rows are therefore
-- deactivated rather than removed, which also preserves referential integrity
-- for any listing already attached to a province or town in the meantime.

-- 1. Return the ten cities to the country, so they remain selectable once the
--    provinces are deactivated.
update public.locations city
set parent_id = country.id
from (select id from public.locations where type = 'country' and country_code = 'ZW') as country
where city.type = 'city'
  and city.country_code = 'ZW'
  and city.parent_id in (
    select id from public.locations
    where type = 'province' and country_code = 'ZW'
  );

-- 2. Deactivate the seeded towns.
update public.locations
set is_active = false
where country_code = 'ZW'
  and type = 'town'
  and source = 'canonical';

-- 3. Deactivate the seeded provinces.
update public.locations
set is_active = false
where country_code = 'ZW'
  and type = 'province'
  and source = 'canonical';
