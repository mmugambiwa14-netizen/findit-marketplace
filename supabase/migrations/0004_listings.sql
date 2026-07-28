-- 0004_listings.sql
-- Replaces: Car, Property, Machinery entities.
--
-- Design decision (approved in audit, section 4): Car/Property/Machinery shared
-- ~24 of ~30 fields (seller info, contact, pricing, location, photos, status,
-- verified, views, timestamps). Rather than three near-duplicate tables, they
-- share one `listings` table plus a slim detail table per category. This does
-- NOT change any user-facing behaviour or field names the app already reads --
-- the service layer (Phase 2) presents the same shape (`Car`, `Property`,
-- `Machinery` objects) to the frontend as Base44 did; only the storage is
-- normalized.

create table public.listings (
  id                uuid primary key default gen_random_uuid(),
  kind              listing_kind not null,

  seller_id         uuid not null references public.users(id),
  seller_name       text,
  contact_phone     text,
  contact_whatsapp  text,
  contact_email     text,

  title             text not null,
  description       text,

  price             numeric(14,2) not null,
  currency          text not null default 'USD',
  deposit           numeric(14,2),
  agent_fee         numeric(14,2),
  additional_fees   numeric(14,2),
  accepts_offers    boolean not null default false,

  variants          jsonb not null default '[]',
  photos            jsonb not null default '[]',

  location_id       uuid references public.locations(id),
  latitude          numeric(9,6),
  longitude         numeric(9,6),

  category          text,
  listing_type      text,

  status            listing_status not null default 'draft',
  created_via       listing_created_via not null default 'single',
  verified          boolean not null default false,
  views             integer not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Hot-path indexes: browse/search by category+status, seller's own listings, recency
create index idx_listings_kind_status on public.listings(kind, status, created_at desc);
create index idx_listings_seller on public.listings(seller_id);
create index idx_listings_location on public.listings(location_id);
create index idx_listings_title_trgm on public.listings using gin (title gin_trgm_ops);
create index idx_listings_price on public.listings(price);

create trigger trg_listings_updated_at
  before update on public.listings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Category-specific detail tables (1:1 with listings, only for matching `kind`)
-- ---------------------------------------------------------------------------

create table public.car_details (
  listing_id    uuid primary key references public.listings(id) on delete cascade,
  brand         text,
  model         text,
  year          integer,
  mileage       integer,
  fuel_type     car_fuel_type,
  transmission  car_transmission,
  condition     text
);

create table public.property_details (
  listing_id     uuid primary key references public.listings(id) on delete cascade,
  property_type  property_type,
  bedrooms       integer,
  bathrooms      integer,
  size_sqm       numeric(10,2)
);

create table public.machinery_details (
  listing_id       uuid primary key references public.listings(id) on delete cascade,
  machinery_type   machinery_type,
  brand            text,
  model            text,
  condition        machinery_condition,
  year             integer,
  usage_hours      integer
);

-- Guardrail: a detail row must match its listing's `kind`. Enforced with a
-- trigger rather than a check constraint since it needs to read the parent row.
create or replace function public.enforce_listing_kind()
returns trigger as $$
declare
  actual listing_kind;
  expected listing_kind;
begin
  -- PostgreSQL trigger functions cannot declare formal arguments. Values
  -- supplied by CREATE TRIGGER are exposed through TG_ARGV instead.
  if tg_nargs <> 1 then
    raise exception 'enforce_listing_kind requires exactly one trigger argument';
  end if;
  expected := tg_argv[0]::listing_kind;

  select kind into actual from public.listings where id = new.listing_id;
  if actual is null then
    raise exception 'listing % does not exist', new.listing_id;
  elsif actual <> expected then
    raise exception 'listing % has kind %, expected %', new.listing_id, actual, expected;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_car_details_kind
  before insert or update on public.car_details
  for each row execute function public.enforce_listing_kind('car');

create trigger trg_property_details_kind
  before insert or update on public.property_details
  for each row execute function public.enforce_listing_kind('property');

create trigger trg_machinery_details_kind
  before insert or update on public.machinery_details
  for each row execute function public.enforce_listing_kind('machinery');

-- Convenience views so read paths can query one row per listing without a
-- manual join in every service function.
create view public.cars with (security_invoker = true) as
  select l.*, cd.brand, cd.model, cd.year, cd.mileage, cd.fuel_type, cd.transmission, cd.condition
  from public.listings l join public.car_details cd on cd.listing_id = l.id
  where l.kind = 'car';

create view public.properties with (security_invoker = true) as
  select l.*, pd.property_type, pd.bedrooms, pd.bathrooms, pd.size_sqm
  from public.listings l join public.property_details pd on pd.listing_id = l.id
  where l.kind = 'property';

create view public.machinery with (security_invoker = true) as
  select l.*, md.machinery_type, md.brand, md.model, md.condition, md.year, md.usage_hours
  from public.listings l join public.machinery_details md on md.listing_id = l.id
  where l.kind = 'machinery';
