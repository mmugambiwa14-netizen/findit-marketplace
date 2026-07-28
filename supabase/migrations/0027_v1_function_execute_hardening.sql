-- 0027_v1_function_execute_hardening.sql
-- Supabase's local default privileges explicitly grant new public-schema
-- functions to anon and authenticated. Revoke those implicit grants and
-- restate the complete V1 application-function execution matrix.

-- Trigger and nested helper functions are never direct browser APIs.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_listing_kind() from public, anon, authenticated;
revoke execute on function public.protect_user_managed_fields() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.protect_listing_managed_fields() from public, anon, authenticated;
revoke execute on function public.protect_service_managed_fields() from public, anon, authenticated;
revoke execute on function public.protect_business_profile_managed_fields() from public, anon, authenticated;
revoke execute on function public.protect_category_identity() from public, anon, authenticated;
revoke execute on function public.require_admin_reason(text) from public, anon, authenticated;
revoke execute on function public.record_admin_action(text, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.normalize_message_body(text) from public, anon, authenticated;
revoke execute on function public.assert_message_rate_limit() from public, anon, authenticated;
revoke execute on function public.is_safe_notification_link(text) from public, anon, authenticated;
revoke execute on function public.create_essential_notification(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.protect_alert_fields() from public, anon, authenticated;
revoke execute on function public.set_listing_expiry_defaults() from public, anon, authenticated;
revoke execute on function public.protect_listing_photo_mutation() from public, anon, authenticated;

-- Authenticated-only functions keep their intended grant but lose anonymous
-- execution inherited from the schema's default privileges.
revoke execute on function public.valid_business_social_links(jsonb) from public, anon;
revoke execute on function public.write_audit_log(text, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.admin_dashboard_stats() from public, anon;
revoke execute on function public.admin_marketplace_rows(text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_moderate_marketplace_item(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_user_rows(text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_user_role(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, user_status, text, timestamptz) from public, anon;
revoke execute on function public.admin_report_rows(text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_review_report(uuid, report_status, text) from public, anon;
revoke execute on function public.admin_audit_rows(text, text, integer, integer) from public, anon;
revoke execute on function public.admin_category_rows() from public, anon;
revoke execute on function public.admin_add_category(uuid, text, text, integer, text) from public, anon;
revoke execute on function public.admin_update_category(uuid, text, integer, boolean, text) from public, anon;
revoke execute on function public.start_listing_conversation(uuid, text) from public, anon;
revoke execute on function public.send_conversation_message(uuid, text) from public, anon;
revoke execute on function public.message_inbox(text, boolean, integer, integer) from public, anon;
revoke execute on function public.message_conversation(uuid) from public, anon;
revoke execute on function public.message_thread_rows(uuid, integer) from public, anon;
revoke execute on function public.mark_conversation_seen(uuid) from public, anon;
revoke execute on function public.set_conversation_block(uuid, boolean) from public, anon;
revoke execute on function public.report_conversation(uuid, text, text) from public, anon;
revoke execute on function public.notification_rows(text, boolean, integer, integer) from public, anon;
revoke execute on function public.notification_unread_count() from public, anon;
revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
revoke execute on function public.has_valid_listing_upload_intent(text) from public, anon;
revoke execute on function public.create_v1_listing_submission(uuid, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.owner_transition_listing(uuid, text) from public, anon;
revoke execute on function public.has_valid_marketplace_image_upload_intent(text) from public, anon;
revoke execute on function public.is_attached_marketplace_image(text) from public, anon;
revoke execute on function public.attach_marketplace_image(uuid, text, text, uuid, integer) from public, anon;
revoke execute on function public.detach_marketplace_image(text, uuid, text) from public, anon;
revoke execute on function public.replace_service_media(uuid, text[], jsonb) from public, anon;
revoke execute on function public.replace_listing_media(uuid, text[], jsonb) from public, anon;
revoke execute on function public.admin_support_request_rows(text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_resolve_support_request(uuid, text) from public, anon;

-- Restate service-only functions defensively in one auditable location.
revoke execute on function public.process_listing_expiry_notifications(timestamptz) from public, anon, authenticated;
revoke execute on function public.authorize_listing_image_upload(uuid, text, text, integer, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.complete_listing_image_upload(uuid) from public, anon, authenticated;
revoke execute on function public.authorize_marketplace_image_upload(uuid, text, text, text, integer, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.complete_marketplace_image_upload(uuid) from public, anon, authenticated;
revoke execute on function public.claim_expired_image_uploads(integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.finalize_image_upload_cleanup(text, uuid, boolean, text, timestamptz) from public, anon, authenticated;

grant execute on function public.process_listing_expiry_notifications(timestamptz) to service_role;
grant execute on function public.authorize_listing_image_upload(uuid, text, text, integer, integer, integer, text) to service_role;
grant execute on function public.complete_listing_image_upload(uuid) to service_role;
grant execute on function public.authorize_marketplace_image_upload(uuid, text, text, text, integer, integer, integer, text) to service_role;
grant execute on function public.complete_marketplace_image_upload(uuid) to service_role;
grant execute on function public.claim_expired_image_uploads(integer, timestamptz) to service_role;
grant execute on function public.finalize_image_upload_cleanup(text, uuid, boolean, text, timestamptz) to service_role;
