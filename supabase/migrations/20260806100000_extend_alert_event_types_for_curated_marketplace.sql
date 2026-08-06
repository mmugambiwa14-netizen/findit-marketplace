begin;

alter table public.app_alerts
  drop constraint if exists app_alerts_v1_event_type_check;

alter table public.app_alerts
  add constraint app_alerts_v1_event_type_check
  check (
    event_type is null
    or event_type in (
      'listing_approved',
      'listing_rejected',
      'listing_expires_soon',
      'report_resolved',
      'account_status',
      'tour_ready',
      'tour_failed',
      'tour_rejected',
      'listing_status_changed',
      'saved_listing_unavailable',
      'peek_request_created',
      'peek_request_answered',
      'business_application_updated',
      'business_category_updated',
      'managed_listing_updated'
    )
  );

commit;
