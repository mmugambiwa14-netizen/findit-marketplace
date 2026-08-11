begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.set_eq(
  $$
    select format(
      '%I.%I(%s)', n.nspname, p.proname,
      replace(oidvectortypes(p.proargtypes), ', ', ',')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  $$,
  array[
    'public.discover_category_counts()',
    'public.get_marketplace_location_hierarchy(uuid)',
    'public.get_public_seller_profile(uuid)',
    'public.is_active_user()',
    'public.is_admin()',
    'public.is_country_browsable(text)',
    'public.is_country_publishable(text)',
    'public.is_super_admin()',
    'public.is_supported_listing_currency(text,text)',
    'public.is_valid_attribute_document(jsonb)',
    'public.jsonb_values_are_http_urls(jsonb)',
    'public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)',
    'public.peek_thread_page(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)',
    'public.public_category_taxonomy_v2(text,text)',
    'public.public_category_taxonomy(text)',
    'public.public_listing_search_card_page_v1(text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'public.public_listing_search_page_v2(text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'public.public_response_peek_metadata(uuid)',
    'public.public_tour_summaries(uuid[],uuid[])',
    'public.public_tour_view_counts(uuid[])',
    'public.record_marketplace_view(text,uuid)',
    'public.record_public_tour_view(uuid,uuid)',
    'public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)',
    'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'public.resolve_category_taxonomy(text,text,text)',
    'public.resolve_marketplace_location(double precision,double precision)',
    'public.search_marketplace_places(uuid,text,integer)',
    'public.submit_support_request(text,text,text,text)'
  ],
  'anonymous function execution is limited to the exact current signature boundary'
);

select extensions.set_eq(
  $$
    select format(
      '%I.%I(%s)', n.nspname, p.proname,
      replace(oidvectortypes(p.proargtypes), ', ', ',')
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  $$,
  array[
    'public.accept_peek_request(uuid)',
    'public.admin_add_category(uuid,text,text,integer,text)',
    'public.admin_add_taxonomy_node_v2(uuid,text,text,text,text,text,boolean,integer,jsonb,text[],text[],jsonb,text[],text)',
    'public.admin_add_taxonomy_node(uuid,text,text,text,text,boolean,integer,jsonb,text[],text[],text)',
    'public.admin_approve_tour(uuid,text)',
    'public.admin_audit_rows_page(text,text,integer,timestamp with time zone,uuid)',
    'public.admin_category_rows()',
    'public.admin_dashboard_stats()',
    'public.admin_list_business_applications(text,integer,timestamp with time zone)',
    'public.admin_list_managed_listing_requests(text,integer,timestamp with time zone)',
    'public.admin_marketplace_rows_page(text,text,text,integer,timestamp with time zone,uuid)',
    'public.admin_moderate_marketplace_item(uuid,text,text,text)',
    'public.admin_notification_fanout_health()',
    'public.admin_operational_health(integer)',
    'public.admin_purge_recommendation_service_cache_v1(text,uuid,integer)',
    'public.admin_recommendation_analytics_v1(date,date)',
    'public.admin_recommendation_configuration_snapshot()',
    'public.admin_reject_tour(uuid,text)',
    'public.admin_report_rows_page(text,text,text,integer,timestamp with time zone,uuid)',
    'public.admin_resolve_support_request(uuid,text)',
    'public.admin_review_business_application(uuid,text,text)',
    'public.admin_review_business_category(uuid,text,text)',
    'public.admin_review_report(uuid,report_status,text)',
    'public.admin_set_user_role(uuid,text,text)',
    'public.admin_set_user_status(uuid,user_status,text,timestamp with time zone)',
    'public.admin_support_request_rows_page(text,text,text,integer,timestamp with time zone,uuid)',
    'public.admin_taxonomy_rows_v2()',
    'public.admin_taxonomy_rows()',
    'public.admin_tour_queue_page(text,text,integer,integer,integer,timestamp with time zone,uuid)',
    'public.admin_tour_review_metadata(uuid)',
    'public.admin_update_category(uuid,text,integer,boolean,text)',
    'public.admin_update_managed_listing_request(uuid,text,text,uuid)',
    'public.admin_update_recommendation_service_policy_v1(text,boolean,integer,integer,integer,integer,jsonb)',
    'public.admin_update_taxonomy_node_v2(uuid,text,text,text,integer,boolean,boolean,text[],text[],jsonb,text[],uuid,timestamp with time zone,jsonb,text)',
    'public.admin_update_taxonomy_node(uuid,text,text,integer,boolean,boolean,text[],text[],uuid,timestamp with time zone,jsonb,text)',
    'public.admin_upsert_recommendation_context_rule_v1(text,uuid,text,text,integer,integer,jsonb,boolean,timestamp with time zone,timestamp with time zone)',
    'public.admin_upsert_recommendation_relationship(uuid,uuid,text,numeric,text,boolean,timestamp with time zone,timestamp with time zone)',
    'public.admin_upsert_recommendation_taxonomy_node(text,text,text,uuid,jsonb,boolean)',
    'public.admin_upsert_recommendation_weight_profile(text,integer,text,jsonb,boolean)',
    'public.admin_user_rows_page(text,text,text,integer,timestamp with time zone,uuid)',
    'public.attach_marketplace_image(uuid,text,text,uuid,integer)',
    'public.bind_response_peek(uuid,uuid[])',
    'public.can_publish_in_category(text)',
    'public.cancel_peek_request_fulfilment(uuid,text)',
    'public.clear_my_recommendation_personalization_data_v1()',
    'public.create_peek_request(uuid,uuid,peek_request_category,text)',
    'public.create_v1_listing_submission(uuid,jsonb,jsonb,jsonb)',
    'public.create_v2_listing_submission(uuid,jsonb,jsonb,jsonb,jsonb)',
    'public.decline_peek_request(uuid,text)',
    'public.detach_marketplace_image(text,uuid,text)',
    'public.disable_web_push_subscription(text)',
    'public.discover_category_counts()',
    'public.get_marketplace_location_hierarchy(uuid)',
    'public.get_my_managed_listing_requests()',
    'public.get_my_publishing_access()',
    'public.get_notification_preferences()',
    'public.get_my_recommendation_personalization_v1()',
    'public.get_public_seller_profile(uuid)',
    'public.is_active_user()',
    'public.is_admin()',
    'public.is_country_browsable(text)',
    'public.is_country_publishable(text)',
    'public.is_super_admin()',
    'public.is_supported_listing_currency(text,text)',
    'public.is_valid_attribute_document(jsonb)',
    'public.jsonb_values_are_http_urls(jsonb)',
    'public.mark_all_notifications_read()',
    'public.mark_conversation_seen(uuid)',
    'public.mark_notification_read(uuid)',
    'public.merge_peek_request(uuid,uuid)',
    'public.message_conversation(uuid)',
    'public.message_inbox_page(text,boolean,timestamp with time zone,uuid,integer)',
    'public.message_inbox(text,boolean,integer,integer)',
    'public.message_thread_page(uuid,timestamp with time zone,uuid,integer)',
    'public.message_thread_rows(uuid,integer)',
    'public.message_unread_count()',
    'public.my_peek_request_activity_page(timestamp with time zone,uuid,integer)',
    'public.my_peek_request_ids(uuid[])',
    'public.notification_rows_page(text,boolean,timestamp with time zone,uuid,integer)',
    'public.notification_rows(text,boolean,integer,integer)',
    'public.notification_unread_count()',
    'public.owner_listing_contacts(uuid[])',
    'public.owner_listing_notes(uuid[])',
    'public.owner_remove_tour(uuid)',
    'public.owner_retry_failed_tour(uuid)',
    'public.owner_service_contacts(uuid[])',
    'public.owner_transition_listing(uuid,text)',
    'public.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)',
    'public.peek_thread_page(uuid,uuid,text,text,integer,timestamp with time zone,uuid,integer)',
    'public.prepare_own_account_deletion(text)',
    'public.public_category_taxonomy_v2(text,text)',
    'public.public_category_taxonomy(text)',
    'public.public_listing_search_card_page_v1(text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'public.public_listing_search_page_v2(text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'public.public_response_peek_metadata(uuid)',
    'public.public_tour_summaries(uuid[],uuid[])',
    'public.public_tour_view_counts(uuid[])',
    'public.queue_response_peek_binding(uuid,uuid)',
    'public.record_marketplace_view(text,uuid)',
    'public.record_public_tour_view(uuid,uuid)',
    'public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)',
    'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'public.register_web_push_subscription(text,text,text,text,text)',
    'public.replace_listing_media(uuid,text[],jsonb)',
    'public.replace_service_media(uuid,text[],jsonb)',
    'public.report_conversation(uuid,text,text)',
    'public.report_tour(uuid,text,text)',
    'public.request_additional_business_categories(text[])',
    'public.resolve_category_taxonomy(text,text,text)',
    'public.resolve_marketplace_location(double precision,double precision)',
    'public.respond_to_business_application(uuid,text)',
    'public.response_peek_request_candidates(uuid)',
    'public.reveal_listing_contact(uuid)',
    'public.reveal_service_contact(uuid)',
    'public.search_marketplace_places(uuid,text,integer)',
    'public.seller_peek_request_queue(bigint,timestamp with time zone,uuid,integer)',
    'public.seller_unbound_response_peeks()',
    'public.send_conversation_message(uuid,text)',
    'public.set_conversation_block(uuid,boolean)',
    'public.set_my_recommendation_personalization_v1(boolean)',
    'public.start_listing_conversation(uuid,text)',
    'public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])',
    'public.submit_managed_listing_request(text,text,text,text,text,text,text,text)',
    'public.submit_support_request(text,text,text,text)',
    'public.update_notification_preferences(boolean,boolean)',
    'public.support_peek_request(uuid)',
    'public.valid_business_social_links(jsonb)',
    'public.withdraw_peek_request_support(uuid)',
    'public.write_audit_log(text,text,text,jsonb,jsonb)',
    'public.write_audit_log(text,uuid,text,jsonb,jsonb)'
  ],
  'authenticated function execution is limited to the exact current signature boundary'
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
