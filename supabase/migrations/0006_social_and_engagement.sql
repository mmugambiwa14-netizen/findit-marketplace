-- 0006_social_and_engagement.sql
-- Replaces: Follow, SavedListing, Review, SellerRating, Inquiry, AppAlert, BusinessProfile.

create table public.follows (
  id               uuid primary key default gen_random_uuid(),
  follower_id      uuid not null references public.users(id) on delete cascade,
  seller_id        uuid not null references public.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (follower_id, seller_id)
);

create index idx_follows_seller on public.follows(seller_id);

create table public.saved_listings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  listing_id    uuid not null references public.listings(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index idx_saved_listings_user on public.saved_listings(user_id);

create table public.reviews (
  id               uuid primary key default gen_random_uuid(),
  seller_id        uuid not null references public.users(id),
  reviewer_id      uuid references public.users(id),
  reviewer_name    text,
  rating           numeric(2,1) not null check (rating between 1 and 5),
  comment          text,
  created_at       timestamptz not null default now()
);

create index idx_reviews_seller on public.reviews(seller_id);

create table public.seller_ratings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references public.users(id),
  buyer_id        uuid not null references public.users(id),
  buyer_name      text,
  listing_id      uuid references public.listings(id),
  listing_title   text,
  rating          numeric(2,1) not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now()
);

create index idx_seller_ratings_seller on public.seller_ratings(seller_id);

create table public.inquiries (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.listings(id) on delete cascade,
  listing_title     text,
  seller_id         uuid not null references public.users(id),
  buyer_id          uuid not null references public.users(id),
  buyer_name        text,
  message           text not null,
  sender_id         uuid not null references public.users(id),
  conversation_id   uuid not null default gen_random_uuid(),
  status            inquiry_status not null default 'new',
  delivered_at      timestamptz,
  read_at           timestamptz,
  attachments       jsonb not null default '[]',
  created_at        timestamptz not null default now()
);

create index idx_inquiries_conversation on public.inquiries(conversation_id, created_at);
create index idx_inquiries_seller on public.inquiries(seller_id);
create index idx_inquiries_buyer on public.inquiries(buyer_id);

create table public.app_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null,
  message       text not null,
  type          alert_type not null,
  link          text,
  is_read       boolean not null default false,
  listing_id    uuid references public.listings(id),
  created_at    timestamptz not null default now()
);

create index idx_app_alerts_user on public.app_alerts(user_id, is_read, created_at desc);

create table public.business_profiles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id),
  company_name           text not null,
  business_type          business_type not null,
  registration_number    text,
  issuing_body           text,
  phone                  text,
  email                  text,
  website                text,
  city                   text,
  address                text,
  description            text,
  avatar_url             text,
  verified               boolean not null default false,
  verification_status    business_verification_status not null default 'none',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_business_profiles_user on public.business_profiles(user_id);

create trigger trg_business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function set_updated_at();
