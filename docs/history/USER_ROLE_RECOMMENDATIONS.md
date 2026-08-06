# FindIt V1 User Role Recommendations

Status: **Approved V1 role model**  
Goal: the smallest role model that safely supports the MVP

## Recommendation

Use exactly two stored application roles in V1:

- `user`
- `admin`

Treat `anon` and `authenticated` as Supabase/Postgres request identities, not
application roles. Do not create seller, dealer, business, lawyer,
practitioner, service provider, support agent, moderator, or super-admin roles
for V1.

## Why two roles are enough

FindIt is a classifieds marketplace. Any active account may buy, sell, and
advertise services. A person may do several of those things at once. Encoding
each activity as an exclusive role creates role-selection UX, migration rules,
admin workflows, policy branches, multi-role conflicts, and support cost
without improving authorization.

The secure question is normally “does this actor own or participate in this
resource?” rather than “what label does this user have?”

| Concept | V1 representation | Reason |
|---|---|---|
| Buyer | Any guest or user browsing/contacting | Buying is an activity, not a role. |
| Seller | User who owns a listing | Ownership is enforced by `seller_id = auth.uid()`. |
| Service provider | User who owns a service | Ownership is enforced by `provider_id = auth.uid()`. |
| Dealer | V1 business-profile type | Specializes a public business profile around vehicle inventory; grants no global privilege. |
| Business | V1 user-owned profile resource | Provides a lightweight professional identity and active inventory; it is not an application role. |
| Agent | Removed as an undefined V1 concept | Define the actual market and permissions before reintroducing it. |
| Lawyer/practitioner | Future verified professional profile | Belongs to the future legal product and credential system. |
| Support agent | No V1 role | One founder support channel does not need a separate workforce model. |
| Moderator | Admin capability in V1 | A separate staff model can be added when team size or least-privilege needs justify it. |
| Super admin | Operational break-glass procedure | Destructive/bootstrap privilege should not be an everyday product role or navigation branch. |

## Role definitions

### Guest

Guest is an unauthenticated request. A guest may:

- read published product and service listings;
- search and filter public inventory;
- view public seller information deliberately included on listings/profiles;
- read Help, safety, privacy, and terms;
- start a phone, WhatsApp, or permitted email contact action; and
- begin authentication when trying to message, save, post, manage, or report.

A guest may not create, update, or delete marketplace rows. Public reads must
always filter to published/active content in RLS or a security-invoker query.

### User

The default role for every confirmed active account. A user may:

- do everything a guest may do;
- manage their own profile/contact preferences;
- create and manage their own product listings and services;
- create and manage one lightweight business/dealer profile and its public
  contact information;
- exchange plain-text messages in listing conversations where they are the
  buyer or seller, and block/report abuse;
- read and mark their own essential operational notifications;
- save/unsave product listings;
- report a listing or user;
- view their own moderation state and actionable rejection reason; and
- delete or export their own account/data under the approved policy.

A user may not:

- change role, status, ban, audit, or verification-managed fields;
- read another user's private profile data;
- change another user's listing/service/favourite/report;
- publish hidden/rejected content by changing a raw status;
- access private admin routes, RPCs, logs, or storage objects; or
- invoke provider/service-role operations.

### Admin

An admin is a named trusted operator. Admin may:

- access the six approved admin destinations;
- moderate product and service listings;
- review and resolve reports;
- suspend, ban, unban, or restore users within defined policy;
- inspect only the personal data required for the moderation task;
- view immutable audit history; and
- manage the constrained category vocabulary without changing stable IDs or
  deleting referenced categories; and
- see operational counts and health relevant to V1.

Every punitive or privileged mutation requires an explicit reason and a
durable audit event. Admin actions must use protected RPCs/Edge Functions or
narrow database grants; a browser role flag is never sufficient.

An ordinary admin may not silently grant admin to another user, erase audit
history, bypass storage ownership, access deferred verification documents, or
use a generic service-role client.

## Capability and relationship model

Capabilities should be derived from state and relationship:

| Capability | Required condition |
|---|---|
| Publish listing/service | Authenticated, account active, input valid, within rate/quota, owns draft |
| Edit/pause/delete | Owns resource and transition is allowed, or admin uses a moderated operation |
| Save listing | Authenticated active user; target is published |
| Report | Authenticated active user; target exists; rate/idempotency rules pass |
| Direct contact | Published target; method enabled by seller; abuse controls pass where applicable |
| Message | Authenticated active participant; published/listing-history target; plain-text/rate/block rules pass |
| Manage business profile | Authenticated active owner; public fields valid; profile grants no elevated capability |
| Read notification | Authenticated owner of that notification |
| Manage category | Authenticated active admin; constrained mutation and audit succeed |
| Moderate | Authenticated active admin using a protected operation |
| View audit | Authenticated active admin; read-only and logged where policy requires |

Account status is an authorization input. `suspended`, `banned`, or deleted
accounts must be denied at the database/trusted-server boundary, not merely
shown a blocked screen.

## Recommended account fields

Keep the V1 profile narrow:

- immutable user ID;
- normalized email from Supabase Auth;
- display name;
- normalized phone and optional WhatsApp preference;
- application role (`user` or `admin`);
- account status, reason, and optional expiry;
- email-confirmed timestamp from Auth;
- created/updated timestamps; and
- terms/privacy acceptance version and timestamp if legally required.

Do not place seller type, dealer type, lawyer status, business verification,
rating, subscription plan, or premium entitlements on the V1 user role.
Business/dealer type belongs to the separately owned profile resource.

## Profile and future organisation model

V1 uses a deliberately small `business_profiles` resource with one user owner
and a `business|dealer` presentation type. A dealer uses the same resource and
normal vehicle listings; it does not need a separate account, inventory table,
or dashboard.

If future evidence justifies staff management, multi-location organizations,
paid dealer capabilities, or lawyer functionality, extend with explicit
resources rather than more global roles:

- `organisations` for multi-user businesses/dealers or a future legal practice;
- `organisation_memberships` with owner/manager/member permissions;
- capability records such as `can_bulk_import` or `can_use_paid_plan`;
- professional profiles linked to a user or organisation; and
- verification assertions that state the exact check, issuer, date, expiry,
  status, reviewer/provider, and appeal outcome.

One person can then belong to multiple organisations and still retain a single
account role. Capability checks remain composable and auditable.

## Super-admin recommendation

The current `super_admin` boolean and bootstrap functions create a dangerous
parallel privilege model. For V1:

- do not expose super-admin navigation or browser mutations;
- provision the initial admin through a documented one-time operational
  procedure with independent authorization;
- make subsequent admin grants a protected, audited process;
- require stronger authentication for admin accounts;
- keep break-glass access time-bound, logged, and outside normal workflows.

Whether the existing column is retained, migrated, or removed depends on the
production user/export evidence and an additive migration plan. This document
does not authorize a schema change.

## Authorization acceptance matrix

Before launch, automated tests must cover at least:

- anonymous, active user A, active user B, suspended user, admin, and trusted
  server identities;
- read/create/update/delete for every active V1 table and view;
- every user-managed versus server/admin-managed column;
- listing/service draft, published, paused, rejected, unavailable, and expired
  states;
- business/dealer public-field reads and owner/unrelated/admin mutations;
- conversation participant isolation, sender-only inserts, block/rate limits,
  immutable messages, and notification owner isolation;
- category public reads and constrained admin-only mutations;
- owner versus unrelated-user media access and deletion;
- report creation, duplicate/rate denial, resolution, and target access;
- admin grant, punitive action, restoration, and audit-failure behavior; and
- direct API attempts that bypass the UI.

## Migration implication

Phase 2 and V1 service migration should converge on this two-role model before
broad Phase 3 work. Existing business/dealer behavior is simplified into the
approved owner-resource model; lawyer behavior remains preserved but dormant
for a Future Version. No frontend code or database policy should infer
privilege from labels, email domains, profile existence, or client-controlled
metadata.
