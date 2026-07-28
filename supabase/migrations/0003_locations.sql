-- 0003_locations.sql
-- Replaces: Location and Neighbourhood entities.

create table public.locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          location_type not null,
  parent_id     uuid references public.locations(id),
  country_code  text not null,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  timezone      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index idx_locations_parent on public.locations(parent_id);
create index idx_locations_country on public.locations(country_code);
create index idx_locations_type on public.locations(type);

create table public.neighbourhoods (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  city            text not null,
  province        text,
  description     text,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  amenities       jsonb not null default '[]',
  safety_rating   numeric(2,1),
  average_price   numeric(14,2),
  status          content_status not null default 'draft',
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_neighbourhoods_city on public.neighbourhoods(city);

create trigger trg_neighbourhoods_updated_at
  before update on public.neighbourhoods
  for each row execute function set_updated_at();
