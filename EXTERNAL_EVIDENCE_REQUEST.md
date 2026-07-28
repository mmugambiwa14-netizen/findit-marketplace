# FindIt Phase 0–3 External Evidence Request

Date: 2026-07-18  
Purpose: identify the exact evidence that cannot be created from the repository
and must not be guessed. Do not place credentials or secret values in this
document or commit them to source control.

## Phase 0 — production baseline

Provide immutable, timestamped exports or read-only reports for:

1. Base44 entity counts for all 40 entity types, including minimum and maximum
   timestamps.
2. A redacted sample and schema export for every entity; preserve identifiers
   and relationship fields while removing unnecessary personal content.
3. The deployed route list and feature configuration, including hidden or
   tenant-enabled functionality.
4. Current user/account totals by role/status and the supported password/account
   export or forced-reset capability.
5. Base44 function schedules, triggers, retry behavior and provider bindings.
6. Current production domains, redirect URLs, email templates, OAuth providers,
   SMTP/SMS configuration state and sender identities.
7. Storage object manifest: object key, logical owner, purpose, visibility,
   MIME type, byte size, checksum and current URL. Secrets are not required.
8. Available backups plus creation time, retention and restore instructions.

These artifacts close observation gaps in `BEHAVIOUR_BASELINE.md`; they do not
authorize destructive migration.

## Phase 1 — database upgrade and reconciliation

Provide a sanitized production-like database snapshot or the last deployed
Supabase schema/migration version, plus the approved RPO/RTO and rollback
owner. A clean local database cannot prove upgrade safety from an unknown prior
state. The supplied snapshot will be restored only into an isolated target for
upgrade, reconciliation and restore rehearsal.

## Phase 2 — authentication acceptance

Provide or configure a non-production Supabase project with:

- permitted local/staging redirect URLs;
- email confirmation and recovery delivery to a controlled test inbox;
- Google/Apple test-provider configuration if those buttons remain enabled;
- ordinary, suspended, banned, admin and super-admin test identities;
- a documented decision for existing Base44 accounts: export/import, account
  linking, or forced password reset.

Do not share service-role keys in chat or documentation. Configure secrets in
the approved environment and provide only the project URL/public anon key to
the browser build.

Current evidence update (2026-07-26): `FindIt Staging`
(`bwgklpxoetrrkutottdb`, London) is provisioned and a disposable hosted smoke
passes confirmed account creation, profile trigger, password login,
own-profile RLS, anonymous denial, logout and cleanup. Redirect URLs still
contain local development values only; SMTP delivery, OAuth providers,
blocked/admin lifecycle fixtures and the Base44-account transition decision
remain outstanding.

## Phase 3 — data and workflow parity

Provide the Phase 0 export plus representative safe fixtures covering at least:

- more than 100 listings in each launch category;
- draft, available, under-offer, sold/expired and rejected states;
- ordinary and business/dealer sellers;
- saved listings, inquiries/messages, reports and essential notifications;
- owner/admin positive cases and unrelated/suspended negative cases.

Required outputs are row-count reconciliation, exception ledger, critical
field hashes/samples, authorization matrix results and browser workflow
evidence. No unmapped row may be silently discarded.

## Evidence handling

- Freeze and checksum every source export before transformation.
- Store sensitive exports outside the repository with least-privilege access.
- Record who produced and approved each artifact and when.
- Use synthetic data when testing behavior; use sanitized exports only for
  reconciliation that synthetic fixtures cannot prove.
- If an artifact cannot be supplied, record the owner, reason, replacement
  evidence and explicit risk acceptance.
