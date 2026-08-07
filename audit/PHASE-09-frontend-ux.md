# PHASE 09 — FRONTEND, UX & ACCESSIBILITY

**Audited ref:** `origin/main` @ `ee6f212` · Static analysis; no browser rendering performed (no running app) — viewport and contrast items are marked UNVERIFIED accordingly.

## 9.1 Accessibility — well above typical for a project at this stage

| Signal | Count | Assessment |
|---|---|---|
| `aria-label` | 206 | Extensive |
| `aria-hidden` | 123 | Decorative icons correctly hidden |
| `role=` | 82 | |
| `<h1` | 68 | Every page template has a heading |
| `sr-only` | 25 | Screen-reader-only text used deliberately |
| `focus-visible` | 31 | Focus rings styled rather than removed |
| `aria-live` | 8 | Async status announced |
| `aria-describedby` | 7 | |
| Landmarks (`main`/`nav`/`header`/`footer`) | 65 | |
| **Skip link** | `src/components/layout/AppLayout.jsx:81` — "Skip to main content" | **Present** |

Spot-checked patterns are correct: `LoadingScreen` uses `role="status"` + `aria-label` (`App.jsx:73`);
`ProtectedRoute` fallback pairs `role="status" aria-live="polite"` with an `sr-only` label (`:8-11`);
error states use `role="alert"` + `aria-labelledby` (`:91`); `BrandLogo` marks the image `aria-hidden`
with the wordmark as accessible text.

**Gaps:**
- `prefers-reduced-motion` appears only **2** times against a UI using `animate-spin`, transitions and an immersive Peek player. → **F-039 (P3)**
- Contrast ratios, 200% zoom, keyboard traps in dialogs, and 320–414px layout behaviour are **UNVERIFIED — needs check**: they require a rendered browser, which this audit did not run.

## 9.2 Design tokens

`src/findit-locked-design.css` + `tailwind.config.js` + `--findit-*` custom properties (control height,
radius, icon size) drive `src/components/ui/button.jsx:8-23`. Only **16** hardcoded hex values across all of
`src/components` and `src/pages` — token discipline is good. The token *names* retain the FindIt prefix,
classified in Phase 0 as harmless internal naming (**F-001** covers user-visible text only).

Theme: `index.html` sets `color-scheme: dark` and `theme_color #050914`, while `mask-icon` colour is
`#2563EB` (blue) — inconsistent with a teal brand direction. → folded into **F-039**.

## 9.3 Touch targets

180 occurrences of `h-11` / `h-12` / `min-h-10` / explicit `min-h-[44px]` sizing. Primary actions use
`h-11` (44px) — e.g. `App.jsx:84`, `ProtectedRoute.jsx:96`, `ContactButtons`. Meets the ≥44×44 guidance on
the paths inspected. Full sweep across every interactive element is **UNVERIFIED — needs check**.

## 9.4 Async state coverage

See `state-matrix.csv`. Summary: loading and error states are consistently present and *differentiated*
(Phase 5 FLOW-20 found no white-screen path and distinct states for render failure, bootstrap failure,
auth-provider outage, missing profile, blocked account, role-check failure and offline). Empty and retry
states are present on the main queues. Offline is handled by a dedicated shell.

## 9.5 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-039 | P3 | CONFIRMED | Reduced-motion support is near-absent (2 occurrences) and the mask-icon colour is inconsistent with the brand direction |

**Unverified without a rendered browser:** contrast, 200% zoom, focus trapping in Radix dialogs, and
responsive behaviour at 320/360/390/414px. Recorded in `a11y-findings.csv` as UNVERIFIED rather than PASS.
