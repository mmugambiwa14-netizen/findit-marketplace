# FindIt V1 Design System

Status: **Approved V1 design contract; implementation in progress**  
Design goal: professional, trustworthy, fast, restrained, and recognisably
marketplace-oriented without decorative “AI-generated” styling

## Principles

1. **Inventory first.** Photos, price, location, and contact are visually more
   important than decoration.
2. **One hierarchy.** A component means the same thing on every screen.
3. **Trust through clarity.** State, ownership, contact method, safety guidance,
   and errors are explicit.
4. **Mobile by default.** Essential actions remain reachable with one hand and
   the keyboard never covers the active field or action.
5. **Quiet confidence.** Use colour and elevation sparingly. No random gradient,
   glassmorphism, oversized rounding, bouncing controls, or decorative motion.
6. **Accessibility is a system property.** Contrast, focus, semantics, names,
   errors, and touch size are built into primitives.
7. **Make the next action obvious.** Every screen answers “What does the user
   most likely want to do next?” with one clear primary action and quieter
   secondary choices.

## Brand expression

FindIt should feel local and useful rather than corporate or luxury-exclusive.
The wordmark remains simple: `FIND` in neutral foreground and `it` in primary
teal. Brand personality is direct, warm, capable, and safety-conscious.

Use imagery from actual inventory. Do not add abstract gradient blobs,
placeholder people, AI-style 3D illustrations, or stock lifestyle banners.

## Typography

Use Inter when self-hosted and cached; otherwise use the system stack:

`Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`

Avoid a runtime Google Fonts dependency for a launch-critical render path.

| Token | Desktop/mobile size | Line height | Weight | Use |
|---|---:|---:|---:|---|
| Display | 40/32 px | 1.1 | 700 | Home hero only |
| H1 | 32/28 px | 1.2 | 700 | One page title |
| H2 | 24/22 px | 1.25 | 650–700 | Major sections |
| H3 | 18 px | 1.35 | 600 | Cards/panels |
| Body | 16 px | 1.5 | 400 | Primary text/forms |
| Body small | 14 px | 1.45 | 400–500 | Supporting content |
| Caption | 12 px | 1.4 | 500 | Metadata, not essential instructions |
| Price | 24/22 px | 1.2 | 700 | Listing price |

Do not use all caps for paragraphs or controls. Reserve small uppercase text
for short labels with adequate tracking. Body text never drops below 14 px;
critical information never relies on caption size.

## Spacing

Use a 4 px base scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

- Page horizontal gutter: 16 px mobile, 24 px tablet, 32 px desktop.
- Page maximum content width: 1200 px; reading/forms: 640–720 px.
- Section spacing: 32 px mobile, 48 px desktop.
- Card internal padding: 16 px compact, 20–24 px detailed.
- Form field gap: 16 px; label-to-control: 6–8 px.
- Grid gap: 12 px mobile, 20–24 px desktop.

Do not improvise 5/7/13/19 px spacing. Dense admin tables may use 12 px row
padding but must retain 44 px minimum interactive targets.

## Colour tokens

Use semantic tokens rather than page-level hex values.

| Token | Light recommendation | Purpose |
|---|---|---|
| Background | `#F8FAFC` | App canvas |
| Surface | `#FFFFFF` | Cards, dialogs, nav |
| Foreground | `#0F172A` | Primary text |
| Muted foreground | `#475569` | Secondary text with accessible contrast |
| Border | `#E2E8F0` | Dividers/controls |
| Primary 700 | `#0F766E` | Primary actions/active state |
| Primary 50 | `#F0FDFA` | Quiet selected/information background |
| Accent | `#D97706` | Limited highlight; never primary text on white without contrast check |
| Success | `#15803D` | Successful/completed state |
| Warning | `#B45309` | Attention/pending state |
| Danger | `#B91C1C` | Destructive/error state |
| Info | `#1D4ED8` | Neutral system information |

Colour is never the sole state indicator. Pair status colour with label and,
where useful, an icon. Category colours are not permitted to mutate the whole
page; categories use a consistent neutral card with one icon or image cue.

Dark mode is deferred for launch. Retain token compatibility but do not accept
it until all MVP screens pass contrast and visual QA in both themes.

## Border radius

- Inputs, buttons, compact badges: 8 px.
- Cards and sheets: 12 px.
- Dialogs and large media containers: 12–16 px.
- Pills: only tags, filters, and status chips.
- Circular: avatars and icon buttons only.

Avoid applying `rounded-xl/2xl` to every control or nesting multiple rounded
containers without hierarchy.

## Elevation

- Level 0: no shadow, border only — most cards and controls.
- Level 1: subtle shadow — sticky navigation and hoverable listing cards.
- Level 2: dialog/sheet — one stronger shadow plus overlay.
- Level 3: prohibited for ordinary content.

Hover uses small border/shadow change; no floating translation or glow.

## Buttons

Variants:

- Primary: one main action per region.
- Secondary: supporting action with neutral surface/border.
- Ghost: toolbar/tertiary action.
- Destructive: confirmed destructive actions only.
- Link: navigation within prose, not a substitute for every button.

Standards:

- Minimum height 44 px on touch screens; 40 px acceptable in desktop tables.
- Minimum target 44×44 px for icon actions.
- Sentence-case labels: “Post listing,” not “POST NOW”.
- Loading keeps width stable, disables repeat submission, and uses a spinner
  plus a meaningful label.
- Disabled controls explain why when the reason is not obvious.
- Icons support the label; common destructive/ambiguous actions never use an
  icon alone.

## Forms

- Persistent visible label for every input; placeholder is an example only.
- Helper text before interaction; validation near the field after interaction.
- Required/optional state is explicit.
- Use native input type and autocomplete attributes.
- Validate on blur/submit without interrupting every keystroke.
- Error summary at the top of long forms links focus to invalid fields.
- Preserve safe input after server/network errors.
- Use single-column forms on mobile and most desktop flows.
- Selects are searchable only when the option list requires it.
- Phone input defaults to Zimbabwe but supports explicit country code; store a
  normalized representation.
- Price groups amount and currency without promising conversion.

## Cards

### Listing card

One standard card for property, vehicle, and machinery:

- fixed aspect-ratio image with stable placeholder;
- category/status cue, not decorative gradient;
- title, price/currency, location;
- two or three category-specific facts;
- seller name only when useful;
- favourite action with accessible name;
- entire descriptive area links to detail, while actions remain separate;
- no premium ribbons, unqualified verified badges, view-count vanity, or
  duplicated contact buttons.

Desktop supports 3–4 columns; mobile uses two compact columns only if title and
price remain readable, otherwise one full-width row/card.

### Service card

Use the same frame with service category, title, service area, price model, and
provider name. Do not imitate a product price when pricing is “from,” hourly,
or contact-based.

### Operational card

Admin/summary cards show an actionable count, short label, and destination.
Avoid decorative charts and unrelated colour per card.

## Image gallery

- Large primary image and thumbnail strip on desktop.
- Swipeable snap gallery with count on mobile.
- Preserve aspect ratio, prevent layout shift, and provide full-screen view.
- Keyboard previous/next/close and visible focus.
- Use responsive derivatives and progressive loading.
- Alt text comes from listing title/category; decorative thumbnails use
  appropriate semantics.
- No auto-advancing carousel.

## Tables and lists

- Tables are for admin desktop density; user screens use responsive lists.
- Header stays visible when useful; rows have clear hover/focus.
- Server-side pagination/filter/sort with visible result count.
- Mobile admin shows essential fields and opens a detail sheet; do not squeeze
  twelve columns into horizontal scrolling as the primary interaction.
- Empty, filtered-empty, error, and loading states are distinct.
- Row actions use one menu with labelled options; destructive actions are
  separated.

## Dialogs, drawers, and sheets

- Dialog: short decision or focused form.
- Drawer/sheet: mobile filters or contextual detail.
- Full page: long creation/edit flows.
- Title and description are programmatically associated.
- Focus enters, is trapped, Escape closes where safe, and focus returns to the
  trigger.
- Destructive confirmation names the object and consequence.
- Do not stack dialogs.

## Badges

Approved badge types:

- status: Draft, Published, Paused, Unavailable, Rejected, Expired;
- category: Property, Vehicle, Machinery, Service;
- explicit fact: Email confirmed, Phone confirmed (only when implemented).

No generic “Verified,” “Trusted,” “Premium,” or “Best” badge in V1. Badges use
short text, semantic colour, and no animated glow.

## Icons

Use one icon family (Lucide already exists). Standards:

- 16 px inline, 20 px controls, 24 px navigation;
- consistent 1.75–2 px stroke;
- icons do not replace labels for unfamiliar actions;
- decorative icons use `aria-hidden`; icon buttons have accessible names;
- avoid emoji as core UI status/category icons because rendering varies.

## Alerts and feedback

- Inline error for field/content failures.
- Page banner for screen-level outage/permission state.
- Toast only for brief confirmation of an action the user initiated.
- Never rely on toast for destructive failure, form validation, or information
  the user needs later.
- Success messages state the result: “Listing published.”
- Errors state recovery: “We could not publish. Your draft is saved. Try again.”

## Navigation

Desktop header is opaque or lightly translucent without glass effects. It
contains logo, Browse, Services, Post listing, Favourites, and Account. Mobile
bottom navigation contains Home, Search, Post, Favourites, and Account.

Signed-in desktop navigation also exposes Messages and a restrained essential-
notification indicator. On mobile they remain reachable through the header or
Account without displacing the five bottom destinations. Business/dealer pages
are reached from profiles and listings rather than a duplicate directory.

Active state uses label, icon weight, and primary colour. Navigation labels do
not change between screens. There is one operational notification list, no
duplicate price/marketing Alerts product, and no hidden user-menu arrays. Admin
uses one navigation source.

## Motion

- 120–200 ms for hover/focus/menu feedback.
- 200–250 ms for sheet/dialog transitions.
- No scroll-reveal sections, bouncing CTAs, gradient animation, autoplay, or
  decorative parallax.
- Respect `prefers-reduced-motion` and make all content immediately available.

## Accessibility contract

- Visible `:focus-visible` ring with at least 2 px separation/contrast.
- Semantic landmarks, headings, lists, forms, buttons, links, tables, and
  dialogs.
- One H1 per screen and logical heading order.
- Form labels and described errors connected by ID.
- 4.5:1 text contrast and 3:1 large text/non-text controls where applicable.
- 44×44 px touch targets and adequate spacing.
- Screen-reader announcements for async results, errors, and publish/upload
  progress without excessive chatter.
- Keyboard operation for filters, galleries, menus, dialogs, and admin actions.
- Zoom/reflow to 200% without loss of function; no fixed-height clipping.

## Content style

- Plain Zimbabwean English; short active sentences.
- “Post a listing,” “Contact seller,” “Save to favourites,” “Report listing.”
- Avoid hype: “10× more views,” “premium,” and unsubstantiated trust claims.
- State currencies and locations precisely.
- Safety copy is concrete: do not send deposits before inspection; meet safely;
  report pressure or suspicious documents.
- Empty states explain the next action without blame.

## Governance

After approval, implement tokens in one source and audit hardcoded colours,
radii, shadows, typography, and duplicate primitives. New components require:

- a documented purpose and variants;
- keyboard/screen-reader behavior;
- loading/error/disabled states;
- mobile and desktop examples; and
- visual regression or story-level evidence before broad reuse.
