# Storage and Media Migration Inventory

**Specification:** FindIt Marketplace Migration Specification v3.0, Document 2 of 4  
**Reviewed baseline:** authoritative Phase 2B archive plus 2026-07-26 Phase 4 local acceptance  
**Status:** approved V1 product photos, service photos and business/dealer logos complete locally; production migration and retained/deferred asset classes remain open

## Current state

The active V1 product-listing, service-photo and business/dealer-logo flows no
longer use Base44 upload. They use two private buckets, two purpose-bound upload
Edge Functions, one internal lifecycle-cleanup Edge Function, upload intent/media ledgers, shared binary image inspection and
signed reads. Upload responses are explicitly non-cacheable and disable MIME
sniffing; signed previews expire after one hour. Eleven `UploadFile` references remain across ten retained
legacy/deferred source files. Most of those callers still rely on an HTML
`accept` value and do not show trusted size, MIME, ownership, privacy, malware,
or retention enforcement.

`listing-images` and `marketplace-images` are implemented in migrations/local
configuration. Other bucket names below remain proposed design labels. Privacy
and retention decisions require product/legal confirmation before those
migrations are written.

## Asset inventory

| Asset class | Current call sites | Current behavior and validation | Intended owner/relationship | Proposed storage class | Migration phase / status |
|---|---|---|---|---|---|
| Listing photos | Active: `ListingMediaContactStep.jsx`, `EditListingDialog.jsx`, `listingCreationService.js`, `listing-image-upload`; retained legacy: `Step3Photos.jsx` | 1–20. Server checks JPEG/PNG/WebP magic bytes, MIME, 5 MiB, 8000 px/40 MP, SHA-256, active owner, generated path and rate limit; strips common privacy metadata/trailing payloads before hash/storage; edit replacement is atomic | Listing owner; single-use upload intent; attached listing relationship | `listing-images`, private bucket; owner/admin read while private and signed public read only after approval | V1 create/edit/sanitization and expired-intent cleanup-worker HTTP lifecycle pass locally; browser/hosted/scanner/full-re-encoding/derivative evidence remains |
| Listing/dealer documents | `src/components/create-listing/Step6Documents.jsx`, `src/components/create-listing/Step7Documents.jsx` | Image/PDF hints; no trusted byte/type/size validation found | Listing owner and authorized reviewers | `listing-documents`, private; signed read only | Phase 4 candidate; inventoried |
| Service photos | `src/pages/CreateService.jsx`, `EditServiceDialog.jsx`, service/media repository and `marketplace-image-upload` | Maximum 6. Shared server checks JPEG/PNG/WebP magic bytes, MIME, 5 MiB, 8000 px/40 MP, SHA-256, active owner, generated path and rate limit; strips common privacy metadata/trailing payloads before hash/storage; edit replacement is atomic | Service owner; single-use purpose-bound upload intent; attached service relationship | `marketplace-images`, private bucket; owner signed read and signed public read only while service/owner are active | V1 create/edit/sanitization and expired-intent cleanup-worker HTTP lifecycle pass locally; browser/hosted/scanner/full-re-encoding/derivative evidence remains |
| Seller avatar/profile media | `src/components/settings/SellerProfileFields.jsx` | Image hint; no trusted size/type enforcement found | Profile owner | `profile-images`, public read; owner write | Phase 4 candidate; inventoried |
| Business logo/profile media | `src/components/business/BusinessProfileForm.jsx`, business/media repository and `marketplace-image-upload` | One logo. Shared server checks JPEG/PNG/WebP magic bytes, MIME, 5 MiB, 8000 px/40 MP, SHA-256, active owner, generated path and rate limit; strips common privacy metadata/trailing payloads before hash/storage | One-owner business/dealer profile; single-use purpose-bound intent | `marketplace-images`, private bucket; owner signed read and signed public read only while profile/owner are active | Add/replace/remove/sanitization and expired-intent cleanup-worker HTTP lifecycle pass locally; browser/hosted/scanner/full-re-encoding/derivative evidence remains |
| General verification evidence | `src/pages/Verification.jsx`, `src/components/verification/QuickReVerify.jsx`, `src/components/verification/ServiceProviderForm.jsx` | Image/PDF hints; no trusted size/type/privacy controls found | Subject user plus authorized verifier | `verification-documents`, private; no public URLs | Phase 4 candidate; security blocker |
| Practitioner portrait | `src/pages/PractitionerSignup.jsx` | Image upload mixed into practitioner onboarding | Practitioner profile owner | `profile-images`, public only after approved publication | Phase 4 candidate; inventoried |
| Practitioner credentials | `src/pages/PractitionerSignup.jsx`, `src/components/credentials/CredentialUploadWidget.jsx` | Image/PDF hints; no trusted size/type/privacy controls found | Practitioner plus authorized verifier | `verification-documents`, private | Phase 4 candidate; security blocker |
| Conversation attachments | `src/components/messaging/ConversationThread.jsx` | Upload is available, but no complete trusted limit/privacy policy is visible | Conversation participants | `message-attachments`, private; membership-authorized signed reads | Phase 4 candidate; inventoried |
| Bulk listing CSV/XLS import | `src/components/bulk/csv/CsvUploadStep.jsx` | Client checks approximately 10 MB and extensions `csv`, `xlsx`, `xls`; then Base44 upload | Authorized importing seller/dealer/admin and import job | `bulk-imports`, private and short-lived | Phase 4 candidate; needs server validation |
| Bulk PDF input | `src/components/bulk/pdf/PdfUploadStep.jsx`, `src/lib/bulkPdf.js` | Client checks approximately 15 MB and PDF extension before the library performs the Base44 upload | Authorized importing seller/dealer/admin and extraction job | `bulk-imports`, private and short-lived | Phase 4 candidate; needs server validation |
| New support-ticket attachments | `src/pages/CreateTicket.jsx` | Selection enforces a count of five and advertises 10 MB each without enforcing it; only name/size metadata is sent and file content is not uploaded | Ticket requester and support participants | `support-attachments`, private | Behavior decision required; current parity defect |
| Support-ticket reply attachments | `src/pages/TicketDetailUser.jsx` | Files may be selected, but send clears them without upload/message association | Ticket requester and assigned/authorized support participants | `support-attachments`, private | Behavior decision required; current parity defect |

## Required object model

Every stored object needs a database metadata row rather than authorization based only on a path string. The product and marketplace-image slices now record owner, purpose/relationship, canonical path, detected MIME, byte count, dimensions, SHA-256, ordering, timestamps, cleanup claims, retries and final state in `listing_upload_intents`/`listing_media` and `marketplace_image_upload_intents`/`service_media`. The remaining asset classes and advanced processing fields still need the full model below. At minimum:

- object ID, bucket, and canonical object key;
- owner user/profile ID and the parent entity relationship;
- asset class and current lifecycle state;
- original filename for display only, never as the authorization key;
- trusted detected MIME, byte count, and content hash;
- upload initiator and server timestamp;
- malware-scan state and scanner result reference;
- publication/privacy state;
- replacement/deletion timestamps and retention hold where applicable.

Object paths should use generated identifiers, for example `<asset-class>/<owner-id>/<object-id>`, not untrusted filenames or email addresses. Ownership checks must join the metadata relationship; a caller must not gain access by guessing a path.

## Proposed privacy rules

- Public delivery is limited to assets deliberately published to marketplace pages. The implemented listing bucket remains private and uses short-lived signed URLs even for approved products.
- Verification, credential, listing-document, message, support, and bulk-import objects remain private.
- Private reads use short-lived signed URLs issued only after a trusted authorization check. Signed URLs must not be stored as durable application data.
- Upload authorization is separate from read authorization. A user who may submit evidence does not automatically gain approval or reviewer access.
- Administrative access is scoped by function and audited; a generic frontend admin flag is insufficient.
- Deleting a database row and deleting its object must be coordinated and retryable so orphaned sensitive files do not persist silently.

## Validation controls

Browser checks are for feedback only. The trusted upload path must enforce:

1. authenticated actor and parent-entity relationship;
2. allowlisted asset class, extension, detected MIME, and file signature/magic bytes;
3. per-file, per-request, per-user, and storage-quota limits;
4. image dimension/pixel limits to prevent decompression bombs;
5. full pixel re-encoding where required (common privacy metadata/trailing-payload stripping is implemented for approved V1 images);
6. PDF/document active-content policy and malware scanning;
7. quarantine until scanning succeeds for sensitive or executable-content containers;
8. generated object keys and normalized display filenames;
9. rate limiting, idempotency, and cleanup for abandoned multipart uploads;
10. structured audit events for sensitive document access and privileged deletion.

Exact byte/count limits are product decisions and should be informed by the current production distribution. The existing 20-photo, 10 MB import, 15 MB PDF, and five-ticket-selection behaviors are baseline evidence, not automatically approved server limits.

## Malware scanning and delivery

- Upload into a non-public quarantine state.
- Trigger an asynchronous scanner from an object-created event or durable job record.
- Make the object readable only after a clean result is recorded.
- Isolate or delete rejected content according to incident and retention policy; notify the uploader without exposing scanner internals.
- Serve public derivatives through a CDN with immutable versioned keys and appropriate cache headers.
- Serve private objects through short-lived signed URLs with conservative cache headers.
- Generate bounded image derivatives rather than repeatedly serving full originals to cards and lists.

Scanner availability, retry behavior, maximum quarantine age, and manual-review escalation must be defined before launch. Upload success must not be confused with scan approval.

## Existing URL migration

Base44 URLs cannot safely be replaced by string substitution. Migration requires a manifest with:

| Field | Purpose |
|---|---|
| Source URL/object reference | Locate the authoritative Base44 object |
| Source entity and field | Preserve relationship and presentation order |
| Expected owner and asset class | Select privacy and target policy |
| Source byte count/hash/MIME | Verify download and detect duplicates |
| Target bucket/key/object ID | Establish the new canonical reference |
| Copy/scan result | Prevent publication before validation |
| Database rewrite state | Make retries idempotent |
| Rollback reference | Restore the original reference during the rollback window |

Required migration sequence:

1. Export references and classify public versus private content.
2. Resolve ownership and flag orphaned or ambiguous records for review.
3. Copy bytes without changing live database URLs.
4. Verify hash, detected type, dimensions/structure, and malware result.
5. Create metadata rows and test target authorization.
6. Rewrite references in bounded, restartable batches with before/after manifests.
7. Verify representative UI, missing-object rate, and access denials.
8. Retain reversible source mappings until the agreed rollback and retention windows close.

## Retention and deletion decisions still required

- verification and practitioner credential retention after approval, rejection, or account deletion;
- message/support attachment retention and legal-hold behavior;
- bulk-import input and generated-output expiry;
- abandoned upload and quarantined-object expiry;
- public media behavior when a listing/service/profile is unpublished;
- user export and deletion obligations;
- backup retention and deletion propagation.

## Acceptance checks

- Anonymous users can read only deliberately public, published derivatives.
- Owners can upload only for parent records they control.
- Unrelated authenticated users cannot list, read, overwrite, or delete private objects even with a guessed key.
- Reviewers can access only the verification material assigned by policy.
- MIME spoofing, oversized files, decompression bombs, and malicious documents are rejected or quarantined.
- Expired signed URLs fail; newly authorized URLs do not outlive the configured window.
- Object replacement does not leave stale public content indefinitely cached.
- Database deletion/object deletion retries are observable and orphan scans reconcile both directions.
- Base44-to-Supabase copy counts, hashes, relationships, and UI presentation are reconciled before cutover.

This inventory is both the record of the locally implemented V1 product,
service and business/dealer image slices and the migration input for retained
asset classes. It does not represent a hosted deployment, scanner, derivative
pipeline, Base44 URL rewrite or production object reconciliation.
