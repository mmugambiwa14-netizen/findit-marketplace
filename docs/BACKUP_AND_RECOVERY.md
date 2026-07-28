# Backup and Recovery

Reviewed: 2026-07-26
Status: logical staging backup verified; provider-native recovery pending

## Verified checkpoint

`scripts/export-staging-backup.ps1` created:

`C:\Users\mmuga\OneDrive\Documents\FindIt Backups\logical-20260726-053312`

The checkpoint covers all 49 public tables, Auth user metadata, both Storage
buckets, and every object. It contains 136 public rows, zero Auth users and zero
objects. Fifty-one artifact hashes were recalculated with zero mismatches.
Secrets are never exported. Git-tracked migrations `0001`–`0030` are the schema
source of truth.

The native `supabase db dump` attempt did not complete because the required
Postgres container image pull stalled. Its processes were stopped and the
temporary CLI database login credential was rotated. The logical export is not
a substitute for provider PITR or a native Auth credential backup.

## Backup command

```powershell
.\scripts\export-staging-backup.ps1
```

The script requires an authenticated Supabase CLI, targets the exact staging
project, writes outside the repository, and emits no secret values.

## Production policy required

- Enable provider-native daily backup/PITR suitable for the approved RPO.
- Take an encrypted native logical backup before every migration/cutover.
- Back up Storage bytes and metadata at the same recovery point.
- Store configuration names and source commit separately from secrets.
- Approve numeric RPO/RTO and a backup owner.
- Restore into an isolated project; never overwrite the only surviving copy.

## Restore sequence

1. Stop unsafe writes and preserve logs.
2. Select the recovery point and immutable source commit.
3. Create an isolated Supabase project in the intended region.
4. Apply the matching migrations and Edge Function configuration.
5. Restore native database/Auth data, then Storage bytes/metadata.
6. Verify counts, checksums, foreign keys, Auth/profile links and privacy.
7. Run schema lint, RLS tests, hosted acceptance and browser smoke.
8. Rotate credentials and invalidate sessions when compromise is possible.
9. Switch traffic only after owner sign-off; monitor and document the incident.

Before launch, rehearse a native isolated restore and record actual recovery
time/data loss. The verified logical checkpoint proves export integrity only.
