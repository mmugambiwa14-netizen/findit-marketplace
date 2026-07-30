-- Zimbabwe administrative hierarchy.
--
-- public.locations already modelled this: location_type carries province, town
-- and district, and parent_id carries the hierarchy. Only a country and ten
-- cities were ever seeded, so no province existed to offer in a filter, and the
-- ten provinces lived instead as a hardcoded PROVINCES array in the browser
-- bundle that nothing read.
--
-- This seeds the provinces as canonical rows, reparents the existing cities
-- beneath the correct province, and adds the towns people search for. Every
-- statement is guarded so a repeated apply is a no-op.

-- 1. Provinces, as children of Zimbabwe.
insert into public.locations (name, type, parent_id, country_code, is_active, source)
select province.name,
       'province'::public.location_type,
       country.id,
       'ZW',
       true,
       'canonical'::public.location_source
from (select id from public.locations where type = 'country' and country_code = 'ZW') as country
cross join (values
  ('Bulawayo'),
  ('Harare'),
  ('Manicaland'),
  ('Mashonaland Central'),
  ('Mashonaland East'),
  ('Mashonaland West'),
  ('Masvingo'),
  ('Matabeleland North'),
  ('Matabeleland South'),
  ('Midlands')
) as province(name)
where not exists (
  select 1
  from public.locations existing
  where existing.type = 'province'
    and existing.country_code = 'ZW'
    and lower(existing.name) = lower(province.name)
);

-- 2. Reparent the ten seeded cities from the country onto their province.
update public.locations city
set parent_id = province.id
from (values
  ('Harare', 'Harare'),
  ('Bulawayo', 'Bulawayo'),
  ('Mutare', 'Manicaland'),
  ('Gweru', 'Midlands'),
  ('Masvingo', 'Masvingo'),
  ('Chinhoyi', 'Mashonaland West'),
  ('Kadoma', 'Mashonaland West'),
  ('Kariba', 'Mashonaland West'),
  ('Marondera', 'Mashonaland East'),
  ('Victoria Falls', 'Matabeleland North')
) as mapping(city_name, province_name)
join public.locations province
  on province.type = 'province'
 and province.country_code = 'ZW'
 and lower(province.name) = lower(mapping.province_name)
where city.type = 'city'
  and city.country_code = 'ZW'
  and lower(city.name) = lower(mapping.city_name)
  and city.parent_id is distinct from province.id;

-- 3. Towns, as children of their province.
insert into public.locations (name, type, parent_id, country_code, is_active, source)
select town.name,
       'town'::public.location_type,
       province.id,
       'ZW',
       true,
       'canonical'::public.location_source
from (values
  ('Chitungwiza', 'Harare'),
  ('Epworth', 'Harare'),
  ('Rusape', 'Manicaland'),
  ('Chipinge', 'Manicaland'),
  ('Nyanga', 'Manicaland'),
  ('Chimanimani', 'Manicaland'),
  ('Buhera', 'Manicaland'),
  ('Headlands', 'Manicaland'),
  ('Penhalonga', 'Manicaland'),
  ('Bindura', 'Mashonaland Central'),
  ('Mount Darwin', 'Mashonaland Central'),
  ('Shamva', 'Mashonaland Central'),
  ('Guruve', 'Mashonaland Central'),
  ('Mvurwi', 'Mashonaland Central'),
  ('Centenary', 'Mashonaland Central'),
  ('Glendale', 'Mashonaland Central'),
  ('Ruwa', 'Mashonaland East'),
  ('Murehwa', 'Mashonaland East'),
  ('Mutoko', 'Mashonaland East'),
  ('Chivhu', 'Mashonaland East'),
  ('Macheke', 'Mashonaland East'),
  ('Wedza', 'Mashonaland East'),
  ('Goromonzi', 'Mashonaland East'),
  ('Chegutu', 'Mashonaland West'),
  ('Karoi', 'Mashonaland West'),
  ('Banket', 'Mashonaland West'),
  ('Norton', 'Mashonaland West'),
  ('Mhangura', 'Mashonaland West'),
  ('Chirundu', 'Mashonaland West'),
  ('Murombedzi', 'Mashonaland West'),
  ('Chiredzi', 'Masvingo'),
  ('Triangle', 'Masvingo'),
  ('Gutu', 'Masvingo'),
  ('Bikita', 'Masvingo'),
  ('Mwenezi', 'Masvingo'),
  ('Chivi', 'Masvingo'),
  ('Zaka', 'Masvingo'),
  ('Mashava', 'Masvingo'),
  ('Hwange', 'Matabeleland North'),
  ('Lupane', 'Matabeleland North'),
  ('Binga', 'Matabeleland North'),
  ('Dete', 'Matabeleland North'),
  ('Nkayi', 'Matabeleland North'),
  ('Tsholotsho', 'Matabeleland North'),
  ('Gwanda', 'Matabeleland South'),
  ('Beitbridge', 'Matabeleland South'),
  ('Plumtree', 'Matabeleland South'),
  ('Filabusi', 'Matabeleland South'),
  ('Esigodini', 'Matabeleland South'),
  ('Insiza', 'Matabeleland South'),
  ('Kwekwe', 'Midlands'),
  ('Zvishavane', 'Midlands'),
  ('Shurugwi', 'Midlands'),
  ('Gokwe', 'Midlands'),
  ('Redcliff', 'Midlands'),
  ('Mberengwa', 'Midlands'),
  ('Mvuma', 'Midlands'),
  ('Lalapanzi', 'Midlands')
) as town(name, province_name)
join public.locations province
  on province.type = 'province'
 and province.country_code = 'ZW'
 and lower(province.name) = lower(town.province_name)
where not exists (
  select 1
  from public.locations existing
  where existing.country_code = 'ZW'
    and existing.type in ('city'::public.location_type, 'town'::public.location_type)
    and lower(existing.name) = lower(town.name)
);
