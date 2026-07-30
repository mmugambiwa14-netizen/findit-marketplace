-- Restore pg_trgm to its pre-0082 schema. Existing trigram indexes retain
-- their operator-class references during the relocation.

alter extension pg_trgm set schema public;

comment on extension pg_trgm is
  'Fuzzy and trigram search support using the pre-0082 public schema location.';
