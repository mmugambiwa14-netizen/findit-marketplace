-- 0082_pg_trgm_extension_schema_security.sql
-- Keep extension-owned functions, operators and operator classes out of the
-- exposed public API schema. pg_trgm is relocatable and existing indexes keep
-- their operator-class OID references when the extension moves.

create schema if not exists extensions;

alter extension pg_trgm set schema extensions;

comment on extension pg_trgm is
  'Fuzzy and trigram search support isolated in the non-API extensions schema.';
