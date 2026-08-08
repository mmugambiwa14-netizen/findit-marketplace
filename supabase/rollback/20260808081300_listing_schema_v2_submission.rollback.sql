-- Rollback capsule for 20260808081300_listing_schema_v2_submission.sql.
--
-- Disable the V2 write surface without narrowing widened text columns or
-- deleting any listing data written through the new schema. Older V1 clients
-- remain on their existing public compatibility boundary.

begin;

revoke all on function public.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;

comment on function public.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  is 'findit:listing-schema-v2-disabled-by-rollback';

commit;
