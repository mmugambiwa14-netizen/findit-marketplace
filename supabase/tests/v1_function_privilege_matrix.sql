begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.set_eq(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  $$,
  array[
    'get_public_seller_profile',
    'is_active_user',
    'is_admin',
    'is_public_marketplace_image',
    'is_super_admin',
    'submit_support_request'
  ],
  'anonymous function execution is limited to the exact public V1 boundary'
);

select extensions.set_eq(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  $$,
  array[
    'admin_add_category',
    'admin_approve_tour',
    'admin_audit_rows',
    'admin_category_rows',
    'admin_dashboard_stats',
    'admin_marketplace_rows',
    'admin_moderate_marketplace_item',
    'admin_reject_tour',
    'admin_report_rows',
    'admin_resolve_support_request',
    'admin_review_report',
    'admin_set_user_role',
    'admin_set_user_status',
    'admin_support_request_rows',
    'admin_tour_queue',
    'admin_update_category',
    'admin_user_rows',
    'attach_marketplace_image',
    'create_v1_listing_submission',
    'detach_marketplace_image',
    'get_public_seller_profile',
    'has_valid_listing_upload_intent',
    'has_valid_marketplace_image_upload_intent',
    'is_active_user',
    'is_admin',
    'is_attached_marketplace_image',
    'is_public_marketplace_image',
    'is_super_admin',
    'mark_all_notifications_read',
    'mark_conversation_seen',
    'mark_notification_read',
    'message_conversation',
    'message_inbox',
    'message_thread_rows',
    'notification_rows',
    'notification_unread_count',
    'owner_remove_tour',
    'owner_retry_failed_tour',
    'owner_transition_listing',
    'replace_listing_media',
    'replace_service_media',
    'report_conversation',
    'report_tour',
    'send_conversation_message',
    'set_conversation_block',
    'start_listing_conversation',
    'submit_support_request',
    'valid_business_social_links',
    'write_audit_log'
  ],
  'authenticated function execution is limited to the exact V1 action boundary'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_essential_notification', 'record_admin_action',
        'claim_expired_image_uploads', 'finalize_image_upload_cleanup',
        'process_listing_expiry_notifications',
        'authorize_listing_image_upload', 'complete_listing_image_upload',
        'authorize_marketplace_image_upload', 'complete_marketplace_image_upload',
        'is_backend_feature_enabled', 'set_backend_feature_enabled',
        'authorize_tour_upload', 'complete_tour_upload',
        'claim_tour_processing_jobs', 'mark_tour_processing_dispatched',
        'authorize_tour_processing_callback', 'heartbeat_tour_processing', 'finalize_tour_processing',
        'fail_tour_processing', 'is_tour_parent_public',
        'is_tour_public_eligible', 'public_tour_metadata',
        'promote_approved_tour', 'claim_tour_cleanup_jobs',
        'finalize_tour_cleanup_job', 'claim_tour_cache_invalidations',
        'finalize_tour_cache_invalidation'
      )
      and (
        has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute')
      )
  ),
  0,
  'internal and service-only privileged functions have no browser execution grant'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_expired_image_uploads', 'finalize_image_upload_cleanup',
        'process_listing_expiry_notifications',
        'authorize_listing_image_upload', 'complete_listing_image_upload',
        'authorize_marketplace_image_upload', 'complete_marketplace_image_upload',
        'is_backend_feature_enabled', 'set_backend_feature_enabled',
        'authorize_tour_upload', 'complete_tour_upload',
        'claim_tour_processing_jobs', 'mark_tour_processing_dispatched',
        'authorize_tour_processing_callback', 'heartbeat_tour_processing', 'finalize_tour_processing',
        'fail_tour_processing', 'is_tour_parent_public',
        'is_tour_public_eligible', 'public_tour_metadata',
        'promote_approved_tour', 'claim_tour_cleanup_jobs',
        'finalize_tour_cleanup_job', 'claim_tour_cache_invalidations',
        'finalize_tour_cache_invalidation'
      )
      and has_function_privilege('service_role', p.oid, 'execute')
  ),
  25,
  'the exact image, expiry and dormant Tour worker functions remain executable by the service role'
);

select * from extensions.finish();
rollback;
