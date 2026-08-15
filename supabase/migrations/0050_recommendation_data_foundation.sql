-- 0050_recommendation_data_foundation.sql
-- Additive recommendation infrastructure. Listing delivery does not depend on any object here.

create extension if not exists pgcrypto;

create table if not exists public.recommendation_taxonomy_nodes (
  id uuid primary key default gen_random_uuid(),
  node_type text not null check (node_type in ('category','subcategory','product','service','tag','location')),
  stable_key text not null,
  parent_id uuid references public.recommendation_taxonomy_nodes(id) on delete restrict,
  label text not null,
  attributes jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (node_type, stable_key)
);

create table if not exists public.recommendation_relationships (
  id uuid primary key default gen_random_uuid(),
  source_node_id uuid not null references public.recommendation_taxonomy_nodes(id) on delete cascade,
  target_node_id uuid not null references public.recommendation_taxonomy_nodes(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('similar','complements','requires','nearby','alternative','accessory')),
  weight numeric(8,6) not null default 1 check (weight >= 0 and weight <= 100),
  reason_code text not null,
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_node_id <> target_node_id),
  check (valid_until is null or valid_until > valid_from),
  unique (source_node_id, target_node_id, relationship_type)
);

create table if not exists public.listing_recommendation_features (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null,
  subcategory_key text,
  country_code text,
  location_key text,
  price_amount numeric,
  currency text,
  specification_tokens text[] not null default '{}',
  quality_score numeric(8,6) not null default 0 check (quality_score between 0 and 1),
  popularity_score numeric(12,6) not null default 0,
  freshness_score numeric(8,6) not null default 0 check (freshness_score between 0 and 1),
  published_at timestamptz,
  projected_at timestamptz not null default now(),
  projection_version integer not null default 1 check (projection_version > 0)
);

create table if not exists public.recommendation_events (
  id uuid not null default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  anonymous_session_id uuid,
  event_type text not null check (event_type in ('view','save','tour_watch','search','chat_start','seller_follow','recommendation_impression','recommendation_click')),
  listing_id uuid references public.listings(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  recommendation_request_id uuid,
  recommendation_service text,
  reason_code text,
  context jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '180 days'),
  primary key (occurred_at, id),
  check (actor_id is not null or anonymous_session_id is not null),
  check (expires_at > occurred_at)
) partition by range (occurred_at);

create table if not exists public.recommendation_events_default
  partition of public.recommendation_events default;

grant select, insert, update, delete on table public.recommendation_events_default to service_role;

create table if not exists public.recommendation_cache (
  cache_key text primary key,
  service_name text not null,
  contract_version integer not null check (contract_version > 0),
  subject_listing_id uuid references public.listings(id) on delete cascade,
  viewer_scope_hash text,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  stale_at timestamptz not null,
  expires_at timestamptz not null,
  check (stale_at >= generated_at),
  check (expires_at > stale_at)
);

create table if not exists public.recommendation_popularity_daily (
  metric_date date not null,
  listing_id uuid not null references public.listings(id) on delete cascade,
  view_count bigint not null default 0 check (view_count >= 0),
  save_count bigint not null default 0 check (save_count >= 0),
  tour_watch_count bigint not null default 0 check (tour_watch_count >= 0),
  chat_start_count bigint not null default 0 check (chat_start_count >= 0),
  recommendation_click_count bigint not null default 0 check (recommendation_click_count >= 0),
  score numeric(18,6) not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (metric_date, listing_id)
);

create index if not exists idx_recommendation_taxonomy_parent_active on public.recommendation_taxonomy_nodes(parent_id, node_type, stable_key) where is_active;
create index if not exists idx_recommendation_relationship_source on public.recommendation_relationships(source_node_id, relationship_type, weight desc, target_node_id) where is_active;
create index if not exists idx_recommendation_relationship_target on public.recommendation_relationships(target_node_id, relationship_type, source_node_id) where is_active;
create index if not exists idx_listing_recommendation_similarity on public.listing_recommendation_features(category_key, subcategory_key, country_code, price_amount, published_at desc, listing_id);
create index if not exists idx_listing_recommendation_seller on public.listing_recommendation_features(seller_id, published_at desc, listing_id);
create index if not exists idx_listing_recommendation_location on public.listing_recommendation_features(location_key, category_key, published_at desc, listing_id);
create index if not exists idx_recommendation_events_actor_cursor on public.recommendation_events(actor_id, occurred_at desc, id) where actor_id is not null;
create index if not exists idx_recommendation_events_session_cursor on public.recommendation_events(anonymous_session_id, occurred_at desc, id) where anonymous_session_id is not null;
create index if not exists idx_recommendation_events_listing on public.recommendation_events(listing_id, event_type, occurred_at desc, id) where listing_id is not null;
create index if not exists idx_recommendation_events_expiry on public.recommendation_events(expires_at, occurred_at, id);
create index if not exists idx_recommendation_cache_expiry on public.recommendation_cache(service_name, expires_at, cache_key);
create index if not exists idx_recommendation_popularity_listing on public.recommendation_popularity_daily(listing_id, metric_date desc);

alter table public.recommendation_taxonomy_nodes enable row level security;
alter table public.recommendation_relationships enable row level security;
alter table public.listing_recommendation_features enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.recommendation_events_default enable row level security;
alter table public.recommendation_cache enable row level security;
alter table public.recommendation_popularity_daily enable row level security;

create policy recommendation_taxonomy_public_read on public.recommendation_taxonomy_nodes for select using (is_active);
create policy recommendation_relationships_public_read on public.recommendation_relationships for select using (is_active and valid_from <= now() and (valid_until is null or valid_until > now()));
create policy recommendation_events_actor_read on public.recommendation_events for select to authenticated using (actor_id = auth.uid());

revoke insert, update, delete on public.recommendation_taxonomy_nodes from anon, authenticated;
revoke insert, update, delete on public.recommendation_relationships from anon, authenticated;
revoke all on public.listing_recommendation_features from anon, authenticated;
revoke insert, update, delete on public.recommendation_events from anon, authenticated;
revoke all on public.recommendation_cache from anon, authenticated;
revoke all on public.recommendation_popularity_daily from anon, authenticated;

grant select on public.recommendation_taxonomy_nodes, public.recommendation_relationships to anon, authenticated;
grant select on public.recommendation_events to authenticated;

comment on table public.recommendation_events is 'Privacy-limited first-party recommendation events. No advertising identifier, fingerprint, message body or contact inference is permitted.';
comment on table public.recommendation_cache is 'Disposable service output cache; listing routes must never require a cache hit.';
