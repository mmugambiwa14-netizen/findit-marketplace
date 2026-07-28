# Phase 1 Data Reconciliation

`phase1_target_inventory.sql` produces active-V1 table counts and orphan/
relationship failure counts without exporting personal content. Run it after
every isolated import and compare it with the immutable Base44 source manifest
requested in `EXTERNAL_EVIDENCE_REQUEST.md`.

Acceptance requires:

- every source row mapped, intentionally deferred, or placed in an exception
  ledger with an approved disposition;
- zero unexplained count differences;
- zero relationship-check failures;
- deterministic email-to-user UUID mapping;
- representative critical-field comparisons or hashes;
- authorization tests using migrated identities; and
- a retained transcript identifying export checksum, migration version,
  target, operator and time.

The repository cannot generate the Base44 source side of this comparison.
Never substitute synthetic counts for production reconciliation evidence.
