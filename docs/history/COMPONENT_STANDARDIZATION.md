# FindIt V1 Component Standardization Plan

Status: **Approved component plan; implementation in progress**

## Objective

The repository currently contains 177 component modules, including 51 UI
primitives, 20 listing components, 20 listing-creation components, parallel notification
screens, duplicate support flows, and three admin navigation definitions.
V1 should consolidate behavior where the same user intent exists while keeping
category-specific content explicit.

This plan does not authorize component deletion. Consolidation may now begin
only in bounded slices after tests protect the replacement.

## Standard component families

### Application shell

| Standard | Responsibility | Consolidation target |
|---|---|---|
| `MarketplaceShell` | Desktop header, mobile bottom nav, content width, safe-area padding | `AppLayout`, `TopNav`, `BottomNav` configuration |
| `AdminShell` | One desktop/sidebar and mobile drawer driven by one route list | `AdminLayout`, `AdminSidebar`, `AdminSidebarCollapsible`, `AdminNavigation` |
| `AuthShell` | Brand, title, subtitle, form card, footer, safe mobile spacing | Existing `AuthLayout` with standard states |
| `PageHeader` | Back/breadcrumb, title, description, primary/secondary action | Repeated sticky headers in Saved, My Listings, Alerts, Support, etc. |
| `AccountMenu` | My Listings, Favourites, Business Profile, Messages, Profile & Settings, Help, Sign out | Replace unused/duplicated user-menu definitions |

One navigation configuration defines label, path, visibility, authentication,
and active matching. Route authorization remains server/database-backed; menu
visibility is presentation only.

### Marketplace discovery

| Standard | Responsibility | Consolidation target |
|---|---|---|
| `MarketplaceSearchBar` | Query input, autocomplete, recent searches, submit, category context, clear | Hero and Search query controls |
| `CategorySelector` | Four curated top-level categories | Home chips, search category chips, creation category step |
| `FilterBar` | Desktop essential filters and result/sort controls | Search desktop controls |
| `FilterSheet` | Mobile filter form with Apply/Clear and applied count | Existing mobile sheet plus category-specific controls |
| `ResultSummary` | Count, query/location context, clear-all | Search header/empty states |
| `Pagination` | Stable next/previous/page or cursor behavior | Replace fixed-limit client filtering |

Filter definitions should be data/configuration with shared URL serialization,
validation, and labels. Do not build separate uncontrolled filters for each
screen.

### Listing presentation

| Standard | Responsibility | Consolidation target |
|---|---|---|
| `MarketplaceCard` | Shared image/title/price/location/favourite frame | Property/car listing cards and machinery card variants |
| `ServiceCard` | Same frame with service-specific price/service area | Current service card variants |
| `ListingGrid` | Responsive grid/list and loading skeletons | `ListingGrid`, `MachineryGrid`, repeated grids |
| `ListingStatusBadge` | Approved status semantics | Page-specific badge class maps |
| `PriceDisplay` | Currency, contact-for-price, from/hourly semantics | Repeated `formatPrice` display logic |
| `LocationDisplay` | Approximate location with privacy-safe format | Repeated location strings |
| `SellerSummary` | Display name, account age, active inventory, explicit confirmed facts | Seller cards across detail/profile |
| `ContactActionBar` | Call, WhatsApp, permitted email, analytics event | Existing contact button variants |
| `MessageSellerButton` | Auth gate and create/open one listing conversation | Existing `MessageDialog` entry behavior, without rich chat |
| `FavouriteButton` | Save/remove with guest gate and optimistic rollback | Heart/bookmark implementations |
| `ReportAction` | Target-aware report dialog/flow | Listing/user/service report actions |

Category details remain typed components (`PropertyFacts`, `VehicleFacts`,
`MachineryFacts`, `ServiceFacts`) inside a shared detail layout. Do not force
unrelated facts into a universal JSON renderer.

### Business, messaging, and notifications

| Standard | Responsibility | Consolidation target |
|---|---|---|
| `BusinessProfileHeader` | Name, logo, type, description, public contact and optional links | Current business/dealer identity components |
| `BusinessInventory` | Active owner listings; dealer variant limits to vehicles and adds inventory search | `DealerListings` and repeated seller grids |
| `BusinessProfileForm` | Owner-editable lightweight V1 fields and logo | Narrow the current business form; remove verification/premium fields |
| `ConversationList` | Listing context, participant, preview, time, unread state | Current Inquiries list behavior |
| `ConversationThread` | Plain-text history/send plus Block/Report | Narrow existing messaging components; no rich features |
| `NotificationList` | Five approved operational event types and read state | Narrow `NotificationCenter`/Alerts duplication |
| `NotificationIndicator` | Owner unread count and accessible entry | Existing notification bell/hook |

### Detail media

Create one `MediaGallery` with:

- responsive primary/thumbnail or swipe layout;
- derivative selection and lazy loading;
- full-screen dialog;
- keyboard and screen-reader behavior;
- image count and error fallback;
- no autoplay.

Replace page-specific gallery variations only after screenshot and interaction
comparison across all three product categories. The same validated image
primitive may render a business logo with a separate aspect/size contract.

### Creation and editing

| Standard | Responsibility | Consolidation target |
|---|---|---|
| `ListingWizard` | Five-step state, draft, navigation, validation, submit | Current nine-step `CreateListing` orchestration |
| `WizardProgress` | Text step name plus progress; accessible current step | `StepProgress` |
| `CategoryFields` | Approved category-specific facts | `Step4Details` large conditional blocks |
| `PriceFields` | Amount/currency/contact-for-price and category rules | `Step2Pricing`, variant/bidding branches removed from V1 |
| `LocationFields` | Curated location selector and privacy explanation | `Step5Location` without exact pin |
| `ImageUploader` | Secure direct upload, progress, order, retry, remove | `Step3Photos` and service upload logic |
| `ContactPreferenceFields` | Call/WhatsApp/email choices | `Step6Contact` and service form contact fields |
| `ReviewSummary` | Accessible pre-publish representation and edit links | Duplicate `Step8Preview`/`Step9Preview` |
| `ListingEditor` | Same schemas/components as creation | Current narrow `EditListingDialog` |

Duplicate `Step6Documents`/`Step7Documents`, `Step7Package`/`Step8Package`, and
`Step8Preview`/`Step9Preview` are explicit consolidation candidates. Document
and package steps are not part of V1.

### Forms

Create standard wrappers around existing accessible primitives:

- `FormField` for label, control, helper, required state, error, and described
  IDs;
- `PriceInput`;
- `PhoneField`;
- `LocationCombobox`;
- `SearchField`;
- `TextareaField` with count only when there is a real limit;
- `FilePicker`/`ImageUploader` with trusted-limit copy;
- `FormErrorSummary`;
- `SubmitButton` with stable pending behavior.

Validation schemas are shared at client and trusted boundaries where practical.
The component displays errors but does not own domain authorization.

### Data states

Every query screen uses:

- `PageSkeleton` or domain skeleton matching final geometry;
- `EmptyState` with title, explanation, and optional one action;
- `FilteredEmptyState` with applied filters and Clear;
- `ErrorState` with safe message, correlation reference where relevant, Retry;
- `OfflineState` when connectivity is known;
- `PermissionState` for deliberate denial.

Replace bare “Loading...” strings, generic spinners that shift layout, and
indefinite checking states.

### Feedback and overlays

- One toast system, not shadcn toaster plus Sonner for overlapping purposes.
- `ConfirmDialog` for named destructive actions.
- `FormDialog` for short admin operations only.
- `FilterSheet` for mobile filters.
- `DetailDrawer` for admin context.
- `GuestGate` shared across favourites/report/post/message actions with return URL.

Choose one feedback library during implementation after behavior inventory;
do not mechanically replace calls without preserving duration, severity, and
recovery behavior.

### Admin

| Standard | Responsibility |
|---|---|
| `AdminPageHeader` | Title, description, one primary action if approved |
| `AdminFilterBar` | Query/status/date filters with URL state |
| `AdminDataTable` | Accessible server-page table, row menu, selection only when needed |
| `ModerationDetail` | Content, owner, report, status, and history context |
| `ReasonDialog` | Structured required reason and consequence |
| `StatusTimeline` | Immutable transition/audit history |
| `MetricLink` | Actionable overview count linked to filtered destination |
| `CategoryManager` | Protected hierarchy rows, label/active/order actions, references, and audit result |

Avoid page-specific cards/tables and multiple navigation definitions.

## Current consolidation map

| Current duplication/inconsistency | Recommendation |
|---|---|
| Property/Car/Machinery detail structures | Shared `ListingDetailLayout` plus typed fact blocks. |
| `ListingGrid` and `MachineryGrid` | One grid with card renderer by kind. |
| Multiple listing card variants | One product card contract; retain only intentionally different compact/full layouts. |
| Two preview components | One `ReviewSummary`. |
| Two document-step components | No V1 component; archive later after evidence. |
| Two package-step components | No V1 component; preserve behind premium flag until approved archival. |
| Alerts and NotificationCenter | One narrow V1 operational notification list; remove price/marketing/social alert behavior. |
| Business/dealer identity components | One Business Profile contract with a dealer vehicle-inventory variant. |
| Message dialog/inquiries/thread variations | One listing-linked plain-text conversation flow with participant controls. |
| Active and duplicate support page families | V1 Help/Contact Support; preserve full ticket system dormant pending evidence. |
| Admin FAQ and support FAQ managers | V1 static Help; no duplicate CMS. |
| Three admin navigation definitions | One route/config source. |
| `CardTitle` rendered as a `div` | Standard heading component/semantic prop so page hierarchy is correct. |
| Many page-specific spinners/empty blocks | Standard domain states. |
| Repeated status colour maps | One semantic status component/token map. |
| Hardcoded rounded/shadow classes | Design-system variants, not arbitrary page overrides. |

## Component boundaries

- UI primitives know visual/accessibility behavior, not marketplace rules.
- Feature components know display and user intent, not database syntax.
- Hooks own query keys, caching, pagination, and mutation UI state.
- Services own validation/orchestration and normalized errors.
- Repositories own Supabase queries/RPC calls.
- Trusted functions/database own authorization, state transitions, rate limits,
  audit, and provider secrets.

Do not create generic abstractions before two real compatible uses exist.
Prefer a small clear category component over a “universal” component with
dozens of boolean props.

## Standardization sequence

1. Freeze approved MVP routes/screens and capture baseline screenshots/states.
2. Establish tokens, typography, spacing, focus, buttons, fields, and data
   states.
3. Standardize app/admin navigation and page headers.
4. Standardize cards, grids, media, price, contact, favourite, and report.
5. Rebuild the five-step wizard from shared schemas/components.
6. Standardize account/help screens.
7. Standardize Business/Dealer Profiles, Messages, and essential Notifications.
8. Standardize the six admin screens.
9. Remove or archive duplicate components only after import, behavior, data,
   and rollback evidence under Documents 1–4.

## Acceptance criteria

- Every MVP screen uses the design tokens and approved semantic primitives.
- One navigation source exists per marketplace/admin shell.
- One card/status/price/contact/favourite/report behavior exists per intent.
- Creation and editing share validation and fields.
- Loading, empty, error, retry, permission, and offline states are consistent.
- Components pass keyboard, screen-reader, touch, reduced-motion, responsive,
  and visual regression checks.
- Consolidation does not change approved business behavior without a recorded
  product/security decision.
