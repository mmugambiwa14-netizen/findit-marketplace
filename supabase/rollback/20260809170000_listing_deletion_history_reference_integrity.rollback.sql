-- Rollback capsule for 20260809170000_listing_deletion_history_reference_integrity.sql.

alter table public.app_alerts
  drop constraint app_alerts_listing_id_fkey,
  add constraint app_alerts_listing_id_fkey
    foreign key (listing_id) references public.listings(id);

alter table public.legal_bookings
  drop constraint legal_bookings_listing_id_fkey,
  add constraint legal_bookings_listing_id_fkey
    foreign key (listing_id) references public.listings(id);

alter table public.reports
  drop constraint reports_listing_id_fkey,
  add constraint reports_listing_id_fkey
    foreign key (listing_id) references public.listings(id);

alter table public.seller_ratings
  drop constraint seller_ratings_listing_id_fkey,
  add constraint seller_ratings_listing_id_fkey
    foreign key (listing_id) references public.listings(id);

alter table public.support_tickets
  drop constraint support_tickets_listing_id_fkey,
  add constraint support_tickets_listing_id_fkey
    foreign key (listing_id) references public.listings(id);
