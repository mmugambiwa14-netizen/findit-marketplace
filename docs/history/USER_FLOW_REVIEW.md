# FindIt V1 User Flow Review

Status: **Approved V1 flow contract; implementation in progress**

## Flow principles

- Guests browse before authentication; sign-in is requested only for a clear
  account benefit or protected action.
- Every protected action retains a safe return URL after authentication.
- V1 optimizes two loops: browse → detail → contact and register → post →
  manage.
- Every step has success, validation, network, permission, empty, and recovery
  behavior.
- Every screen answers “What does the user most likely want to do next?” and
  gives that action clear priority.
- No flow enters payment, verification, rich/social messaging, booking, legal,
  or premium upsell.

## 1. First visit and discovery

**Goal:** understand FindIt and reach relevant inventory quickly.

Flow:

1. Open Home.
2. See clear marketplace promise and search field.
3. Search directly or choose Property, Vehicles, Machinery, or Services.
4. Land on Search with category/query encoded in the URL.
5. See results, result count, essential filters, and sort.

Improvements over current behavior:

- Remove repeated Hot Right Now/New to Market/Latest sections using the same
  data.
- Remove Pricing from primary navigation.
- Replace reveal animations with immediate content and stable skeletons.
- Ensure the hero uses real search intent, not marketing decoration.

Failure/edge behavior:

- Home inventory failure leaves search/categories usable.
- Empty category shows alternative location/category and Post action.
- Offline state explains saved/cached limitations and Retry.

## 2. Search and filtering

**Goal:** reduce a complete inventory set to relevant results.

Flow:

1. Enter a query with keyboard-accessible autocomplete or choose a private
   on-device recent search.
2. Select location and price range.
3. Add only category-relevant filters.
4. Apply filters; URL and server query update.
5. Change sort or page without losing state.
6. Open a result; Back restores exact results/scroll where practical.

Requirements:

- Server-side validated search/filter/sort/pagination.
- Debounced suggestions use only curated categories/locations and safe public
  listing terms; recent searches have an obvious Clear action.
- Pagination uses deterministic ordering and URL state survives refresh/share.
- No 100-record client-side ceiling.
- Mobile filter sheet shows applied count, Reset, and result count before Apply.
- Invalid/tampered URL values normalize safely and never widen private access.
- Search terms and contact details are not exposed in public analytics logs.

## 3. View listing and contact seller

**Goal:** evaluate an offer and contact its owner confidently.

Flow:

1. Open listing detail from card/share URL.
2. Review gallery, price, location, facts, description, seller, and updated date.
3. Read brief safety guidance.
4. Choose Message seller, WhatsApp, Call, or permitted Email.
5. A signed-in user opens the one listing-linked plain-text conversation, or
   an external contact app opens with minimal safe context.

Guest behavior:

- Direct contact is allowed for published listings; do not force registration
  merely to reveal the product's primary value.
- Messaging requires authentication and returns to the intended listing or
  conversation after sign-in.
- Favourites and Reports may prompt authentication with a return URL.

Failure/edge behavior:

- Missing/removed listing shows a respectful unavailable state and similar
  category link, never a generic crash.
- Missing phone/WhatsApp hides that action rather than disabling it silently.
- Seller viewing own listing sees Manage rather than misleading Contact.
- Reported/suspicious content remains public only according to moderation state.

## 4. View service and contact provider

**Goal:** find a service provider without a booking system.

Flow mirrors listing discovery/detail/contact, using service category, area,
pricing type, provider, and contact. Remove Book, Dispute, Legal Payment, and
Earnings affordances. If service supply is sparse, Search shows category
guidance rather than fake placeholder providers.

## 5. Register and confirm email

**Goal:** create a safe account with minimal friction.

Flow:

1. Open Register from protected action or Account.
2. Enter email, password, display name, and phone/contact preference only if
   required for the immediate action.
3. Accept current terms/privacy.
4. Submit once; show confirmation instructions.
5. Open email link; return to the exact allowed app origin.
6. Session/profile loads; continue to safe return URL.

Simplifications:

- Email/password is the only launch path.
- Google is hidden until provider acceptance; Apple is future.
- Do not force phone OTP or verification documents.
- If confirmation is disabled in an environment, branch on returned session
  instead of showing false email instructions.

Edge cases: existing email, weak/leaked password, delayed/expired/reused link,
trigger/profile failure, resend throttling, multiple tabs, and unsafe redirect.

## 6. Sign in, restore session, and sign out

**Goal:** access the account reliably across visits.

Flow:

1. Enter email/password.
2. Establish Supabase session and load profile.
3. Enforce account status at trusted boundaries.
4. Return to intended route.
5. Refresh restores session without a full-screen flash of incorrect state.
6. Sign out clears session across relevant tabs and returns to Home/Login.

Network/profile failure must not be silently reclassified as “logged out.” Show
a retryable service state. A suspended user sees reason/expiry/support route,
but the database also denies protected operations.

## 7. Recover password

**Goal:** regain account access without account enumeration or session abuse.

Flow:

1. Submit email; always show generic success.
2. Open allowed recovery link.
3. App records a genuine matching `PASSWORD_RECOVERY` event.
4. Enter and confirm a compliant new password.
5. Recheck recovery state, update once, clear marker, and route to Sign in.

Test expired, reused, ordinary signed-in session, refresh, multiple tabs,
provider failure, and password policy. Never reveal whether an account exists.

## 8. Save to favourites

**Goal:** return to interesting product listings.

Flow:

1. Tap heart/bookmark on card or detail.
2. Guest sees concise sign-in prompt with return URL.
3. Signed-in user receives immediate optimistic state.
4. Server creates/deletes unique owner relationship.
5. Failure rolls back and explains Retry.
6. Favourites screen shows current published inventory.

Use one term and one icon. If a saved listing is no longer available, show a
short unavailable row with Remove rather than silently losing the record,
subject to retention/privacy policy.

## 8A. Message a seller

**Goal:** continue a private listing-specific buyer/seller conversation inside
FindIt without creating a social network.

Flow:

1. Select Message seller on a published listing.
2. Authenticate when required and return to the listing.
3. Create or reopen the one buyer/listing conversation.
4. Exchange validated plain-text messages.
5. Inbox shows listing context, last-message time, and an unread indicator.
6. Either participant may Block or Report; the server enforces participant,
   rate, retention, and account-status rules.

There are no attachments, images, read receipts, typing indicators, online
presence, reactions, voice messages, groups, AI, or automated moderation. If
participant authorization or abuse controls fail, messaging fails closed and
the approved direct contact actions remain available.

## 8B. Receive an essential notification

**Goal:** understand an operational marketplace or account decision and take
the relevant next action.

Flow:

1. A trusted operation creates one approved event: listing approved/rejected/
   expiring, report resolved, or account suspended/restored.
2. The owner sees a small unread indicator and opens Notifications.
3. The notice explains the event and links safely to the relevant screen.
4. The owner marks the item or list read.

No marketing, price alerts, message duplicates, realtime presence, filtering,
or complex preference flow is introduced.

## 9. Post a product listing

**Goal:** publish quality inventory with minimum effort.

Flow:

1. Guest selects Post → authenticates → returns to creation.
2. Category: choose Property, Vehicle, or Machinery and offer type.
3. Details: title, description, price/currency, category facts.
4. Location: select city/area; explain approximate public location.
5. Photos/contact: securely upload/reorder photos and choose contact methods.
6. Review: see public representation, edit any section, accept rules, publish.
7. Success: view listing or manage listings.

Behavior:

- Draft is saved deliberately and before risky navigation.
- Validation is per step plus trusted final validation.
- Upload progress/retry is per image; publish waits for approved media state.
- Package, document, exact map, variant, bid, and phone-OTP steps are absent.
- Publish is idempotent and has a stable success result.

## 10. Post a service

Use the same five-step shell with Service category, service area/travel, pricing
model, images/contact, and review. A service does not create a booking,
practitioner, verification, dispute, or payment record. My Listings manages it
alongside product inventory with a clear Service label.

## 11. Manage own inventory

**Goal:** keep marketplace supply accurate.

Flow:

1. Open My Listings from Account.
2. Filter All, Published, Draft, Paused, Unavailable/Expired.
3. Open/preview or choose Edit, Pause/Resume, Mark unavailable, Renew, Delete.
4. Confirm consequential actions; trusted transition executes.
5. Row status/history updates and remains understandable.

Replace the current four tiny stat cards and separate category fetches with one
paginated owner inventory view. Delete is not a substitute for “sold/unavailable.”
Draft edit uses the same fields/schema as creation.

## 12. Report listing or user

**Goal:** flag abuse with low friction and enough actionable context.

Flow:

1. Choose Report from listing/detail/seller context.
2. Authenticate if required and return to dialog.
3. Select curated reason and add optional safe details.
4. Submit once; server applies identity, rate, target, duplicate, and abuse
   controls.
5. Show reference/confirmation without exposing moderation outcome promises.
6. Admin resolves through Reports with linked actions and audit.

For urgent safety, Help must state the appropriate external emergency/legal
channel; FindIt must not imply real-time emergency response.

## 13. Profile and settings

**Goal:** maintain only information required for marketplace use.

One Account screen contains:

- display name;
- phone and WhatsApp preference;
- email display/change workflow;
- password/security actions;
- terms/privacy links;
- sign out; and
- account deletion/export entry.

Remove separate seller-profile fields, avatar/bio/currency conversion,
verification, subscription, and transaction links from V1. Keep a focused
Business Profile entry for an owner who needs a professional identity.

## 13A. Create or manage a Business/Dealer Profile

**Goal:** present commercial inventory professionally without adding a new
account role or enterprise dashboard.

1. Open Business Profile from Account/My Listings.
2. Choose Business or Dealer presentation.
3. Enter name, logo, description, contact details, appropriate public address,
   and optional validated website/social links.
4. Preview and save through owner-authorized validation.
5. Public profile shows the identity and active owner listings; Dealer filters
   the presentation to searchable vehicle inventory.

There is no verification, subscription, analytics, staff management, premium
tool, financing, payment, or separate listing-management flow.

## 14. Get help

**Goal:** answer common questions and contact the founder when necessary.

Flow:

1. Open Help from Account/footer/safety context.
2. Search or scan concise FAQs and safety guidance.
3. Choose Contact Support.
4. Submit category, email, message, and optional listing/report reference.
5. Receive confirmation/reference; request reaches monitored inbox.

No ticket portal, chat, attachment picker, assignment, priority promise, or AI
assistant. Support expectations and operating hours are honest.

## 15. Admin moderation flow

**Goal:** resolve marketplace risk with evidence.

1. Admin authenticates and passes server/database admin check.
2. Overview or Reports indicates actionable work.
3. Admin opens report, listing/service, and user context.
4. Admin selects approved action and enters required reason.
5. Protected operation validates current state and persists action plus audit.
6. UI shows stable result and linked audit reference.

Category maintenance is a separate narrow flow: open Categories, add an
approved subcategory or change label/active/order, review affected-listing
count, confirm, and receive an audit reference. Protected top-level and
referenced category rules cannot be bypassed in the browser.

Test stale state, double submission, revoked admin, suspended admin, audit-write
failure, target already removed, and concurrent moderation.

## 16. Error, unavailable, and recovery flow

Every route distinguishes:

- not found;
- no longer available;
- permission denied;
- authentication required;
- account blocked;
- temporary service failure;
- offline;
- invalid/expired link; and
- unexpected application error.

Each state has one accurate explanation and one or two safe next actions. Never
redirect an unknown error to Home without context, spin indefinitely, or expose
raw provider/database messages.

## Cross-flow acceptance

- Mobile, desktop, keyboard, screen-reader, slow network, offline transition,
  empty/error, and browser-back behavior are verified.
- Auth return URLs are allowlisted and preserved.
- Forms preserve safe work after recoverable failure.
- All mutations are idempotent or clearly protected from double submission.
- State and permissions are enforced at trusted boundaries.
- Analytics records outcomes without collecting message content or secrets.
- No user can enter an excluded verification, payment, booking, rich messaging,
  AI, premium, or legal flow from V1.
