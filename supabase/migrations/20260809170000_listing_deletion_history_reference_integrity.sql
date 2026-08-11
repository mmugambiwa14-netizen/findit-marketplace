-- Listing deletion is an explicit owner/admin capability. Historical records
-- must survive that deletion without retaining a dangling hard dependency on the
-- marketplace row. All five references are nullable and are therefore detached
-- rather than allowed to block deletion or cascade away audit/history data.

alter table public.app_alerts
  drop constraint app_alerts_listing_id_fkey,
  add constraint app_alerts_listing_id_fkey
    foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.legal_bookings
  drop constraint legal_bookings_listing_id_fkey,
  add constraint legal_bookings_listing_id_fkey
    foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.reports
  drop constraint reports_listing_id_fkey,
  add constraint reports_listing_id_fkey
    foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.seller_ratings
  drop constraint seller_ratings_listing_id_fkey,
  add constraint seller_ratings_listing_id_fkey
    foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.support_tickets
  drop constraint support_tickets_listing_id_fkey,
  add constraint support_tickets_listing_id_fkey
    foreign key (listing_id) references public.listings(id) on delete set null;
