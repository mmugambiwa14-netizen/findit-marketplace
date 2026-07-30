begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

with expected(table_name, column_name) as (
  values
    ('announcements', 'published_by'),
    ('app_alerts', 'listing_id'),
    ('conversation_reports', 'reporter_id'),
    ('conversation_reports', 'reviewed_by'),
    ('conversations', 'last_message_sender_id'),
    ('essential_notification_fanout_jobs', 'listing_id'),
    ('inquiries', 'listing_id'),
    ('inquiries', 'sender_id'),
    ('legal_bookings', 'listing_id'),
    ('legal_practitioners', 'user_id'),
    ('listing_media', 'owner_id'),
    ('listing_private_locations', 'owner_id'),
    ('listing_tour_events', 'actor_id'),
    ('listing_tour_slots', 'pending_tour_id'),
    ('locations', 'promoted_by'),
    ('marketplace_feature_controls', 'updated_by'),
    ('marketplace_operational_controls', 'updated_by'),
    ('neighbourhoods', 'created_by'),
    ('practitioner_payouts', 'booking_id'),
    ('practitioner_reviews', 'booking_id'),
    ('practitioner_reviews', 'reviewer_id'),
    ('reports', 'reporter_id'),
    ('reports', 'reviewed_by'),
    ('reviews', 'reviewer_id'),
    ('seller_ratings', 'buyer_id'),
    ('seller_ratings', 'listing_id'),
    ('service_bookings', 'cancelled_by'),
    ('service_disputes', 'admin_id'),
    ('service_disputes', 'raised_by'),
    ('service_media', 'owner_id'),
    ('services', 'base_location_id'),
    ('services', 'location_id'),
    ('support_agents', 'user_id'),
    ('support_messages', 'sender_id'),
    ('support_requests', 'resolved_by'),
    ('support_tickets', 'listing_id'),
    ('terms', 'last_updated_by'),
    ('ticket_activity_log', 'actor_id'),
    ('ticket_attachments', 'message_id'),
    ('ticket_attachments', 'uploaded_by'),
    ('ticket_templates', 'team_id'),
    ('verification_requests', 'reused_from_id'),
    ('verification_requests', 'reviewed_by')
), uncovered as (
  select expected.table_name, expected.column_name
  from expected
  join pg_class as table_relation
    on table_relation.relname = expected.table_name
  join pg_namespace as table_schema
    on table_schema.oid = table_relation.relnamespace
   and table_schema.nspname = 'public'
  join pg_attribute as foreign_key_column
    on foreign_key_column.attrelid = table_relation.oid
   and foreign_key_column.attname = expected.column_name
  where not exists (
    select 1
    from pg_index as index_definition
    where index_definition.indrelid = table_relation.oid
      and index_definition.indisvalid
      and index_definition.indisready
      and index_definition.indpred is null
      and (index_definition.indkey::smallint[])[0] = foreign_key_column.attnum
  )
)
select extensions.is(
  (select count(*)::bigint from uncovered),
  0::bigint,
  'every advisor-reported foreign key has a valid leading-column index'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_indexes
    where schemaname = 'public'
      and indexname like 'idx_fk_%'
  ),
  43::bigint,
  'all 43 dedicated foreign-key indexes are present'
);

select extensions.finish();
rollback;
