# UI audit: offline buyer-research workbench

Scope: `dist/` workbench only. Evidence below is from source inspection on 2026-10-15; rendered/browser checks are intentionally left to the root agent.

Assumptions: the primary user is a sales or research reviewer deciding whether a synthetic lead has usable demand evidence. The primary task is to classify the list, select one record, and review its quote, dates, gaps, and next action. Task creation and queue control are supporting operations. Existing Python standard-library API, SQLite persistence, idempotent request IDs, fixed synthetic input, and public/private boundary remain unchanged.

## Findings

### [P1] Evidence review has no stable master-detail reading path

- Layer: contextual
- Evidence: `dist/index.html:18-27` gives task creation and the public boundary the first two-column region, while the primary evidence area starts later. `dist/app.js:20-22` repeats records as equal cards and hides quote, dates, source, and gaps inside each `<details>` element.
- Impact: a reviewer must scan repeated cards and open them one by one to compare classifications or assemble the evidence for the selected lead. The requested primary task is visually subordinate to task creation.
- Basis: dashboard hierarchy should prioritize current state, exceptions, and available actions; related labels, values, evidence, and actions should be grouped.
- Minimal fix: make classification/list and one persistent selected-record detail the main workspace. Keep quote, dates, gaps, and next action together and visible. Move creation, boundary, and queue into a secondary rail below or beside the primary workspace.
- Confidence: high
- Verification: source finding confirmed; browser result not tested.
- Pass condition: at 1440 px the category controls, record list, and selected detail form the first dominant region; changing selection updates one visible detail panel containing original quote, publication/deadline, gaps, and next action. At 320 px the reading order remains filters → records → selected detail → supporting operations without page-wide horizontal scrolling.

### [P1] Connection lifecycle is implicit and writes are enabled before readiness

- Layer: required
- Evidence: `dist/app.js:5-8` tracks only data, selection, and a generic `busy` flag. `dist/app.js:11-17` has no timeout, retry, or stale handling. `dist/app.js:27` enables enqueue whenever not busy, including before `/api/state` succeeds. `dist/app.js:64` places an initial-load error only in the form message. No loading, ready, error, or stale state is exposed.
- Impact: when the local service is slow or unavailable, users cannot distinguish loading from disconnected state, cannot retry in place, and can attempt writes without a valid state connection.
- Basis: meaningful loading, error, disabled, and success states; errors must identify a recovery path; unavailable writes must not appear operable.
- Minimal fix: add a global connection status region with explicit `loading`, `ready`, `error`, and `stale` labels, a retry control, request timeout, last-success time, and stale transition. Disable every POST-backed control until the latest state is valid; preserve entered product text and request ID across failed retries.
- Confidence: high
- Verification: source finding confirmed; browser result not tested.
- Pass condition: initial load announces loading; success announces ready; failed/expired state announces error/stale and exposes retry; enqueue, pause, resume, next, and cancel are disabled unless connected and ready. Retrying a failed enqueue reuses the same idempotency key.

### [P2] Core reading text and tags are below the requested minimum

- Layer: required
- Evidence: `dist/styles.css:1-2` does not set a 16 px body role, and sets key content to 11–14 px (`.heading` copy 14 px, `.hint` 12 px, record copy 13 px, `.tag` 11 px, details 12 px, footer 11 px). Letter spacing is applied to multiple labels, including `.eyebrow`.
- Impact: evidence, guidance, and state information are unnecessarily difficult to read, especially under zoom or on narrow screens; tags fail the explicit 13 px minimum.
- Basis: user requirement: body 16 px, labels at least 13 px, no forced Chinese tracking.
- Minimal fix: establish 16 px body/content text, 13 px minimum labels/metadata, remove routine tracking from Chinese text, and retain denser sizing only where it remains at least 13 px.
- Confidence: high
- Verification: source finding confirmed; browser result not tested.
- Pass condition: computed body/content text is 16 px or larger, every label/tag is at least 13 px, and Chinese-visible text has normal letter spacing.

### [P2] Sidebar navigation is visually styled but not semantically grouped

- Layer: required
- Evidence: `dist/index.html:11-13` places navigation items directly in `<aside>`; the active item is a non-interactive `<div>`, while two peers are links. There is no `<nav>` landmark or current-page attribute.
- Impact: keyboard and assistive-technology users receive an inconsistent navigation model and no programmatic current location.
- Basis: landmarks and control semantics must express visible hierarchy without styling alone.
- Minimal fix: use a labeled `<nav>` with links for all destinations and `aria-current="page"` for the workbench entry.
- Confidence: high
- Verification: source finding confirmed; accessibility tree and keyboard traversal not tested.
- Pass condition: source contains one labeled navigation landmark, all three entries are links, and exactly one exposes `aria-current="page"`.

### [P2] Record selection and status feedback need explicit accessible semantics

- Layer: required
- Evidence: `dist/app.js:22` creates articles with disclosure controls rather than a single-selection control linked to a detail region. `dist/index.html:23-27` uses live regions for counts and queue text, but there is no global status/error region or selected-record relationship.
- Impact: selected state, refreshed content, and recovery feedback are harder to perceive without visual inspection.
- Basis: controls need programmatic names matching their purpose; selected and error states must be communicated by more than color.
- Minimal fix: implement records as native buttons with `aria-pressed`/accessible labels, keep a named detail region, and provide polite status plus alert output for connection failures.
- Confidence: high
- Verification: source finding confirmed; screen-reader behavior not tested.
- Pass condition: each record selector is keyboard-operable, selected state is programmatic and textual/structural, detail has a heading, and errors use an alert while non-error transitions use status.

## Pattern summary

- Hierarchy: the current page leads with creation and equal cards; redesign should lead with triage and a master-detail evidence workspace.
- Typography: current 11–14 px metadata is too small for evidence review; use 16 px content and at least 13 px labels.
- Density: retain compact queue controls, but stop hiding the selected record's decision-critical evidence.
- Responsiveness: the existing card grid collapses, but the new primary workspace needs an explicit 320 px reading order and narrow-safe wrapping for sources and dates.
- Interaction: current hover/focus styling exists, but connection lifecycle, retry, stale data, and disabled writes are missing.

## Verification matrix before implementation

| Check | State / viewport | Result | Evidence | Follow-up |
| --- | --- | --- | --- | --- |
| Source semantics | current `dist/` | fail | findings above | add landmarks, native selection controls, named status regions |
| Initial loading / ready | runtime | not tested | browser QA reserved for root agent | confirm announcements and enabled state after `/api/state` |
| Error / retry / stale | runtime | not tested | no browser run in this task | simulate failed API and elapsed stale timer |
| Keyboard and visible focus | all controls | not tested | source focus rule only | traverse complete page and activate selection/retry/queue controls |
| Reflow | 320, 375, 768, 1440 px | not tested | source media queries only | capture stable screenshots and check overflow |
| Text resize | 200% | not tested | browser required | inspect clipping and loss of actions |
| Text spacing override | workbench | not tested | browser required | apply WCAG spacing override |
| Reduced motion | workbench | not tested | no meaningful motion currently | verify status transitions add no required motion |
| API, SQLite, idempotency | existing tests | not tested for redesign | current unit coverage exists | retain and run all tests; add static/behavior checks |

Top changes: (1) evidence-first master-detail workspace, (2) explicit connection lifecycle with safe disabled writes and retry, (3) readable semantic responsive foundation.

## Implementation closure

Implemented on 2026-10-15 without changing API routes, the SQLite schema, classifier behavior, synthetic records, or the public/private execution boundary.

| Finding | Source / automated status | Browser status |
| --- | --- | --- |
| Evidence-first master-detail path | pass — selected detail contains quote, publication/deadline, gaps, and next action; UI contract test covers required labels | not tested |
| Connection lifecycle and safe writes | pass — loading/ready/error/stale, timeout, retry, ready guard, and initially disabled write controls are present; UI contract tests pass | not tested |
| Type scale and requested palette | pass — 16 px root, 13 px minimum labels/tags, no `letter-spacing`, and required color tokens are asserted | not tested |
| Semantic navigation | pass — labeled `<nav>`, link-based entries, and one `aria-current="page"` are asserted | not tested |
| Record selection semantics | pass — native record buttons expose `aria-pressed`; detail and status regions are named in source | not tested |

Root-agent browser QA still needs the width, zoom, keyboard, focus, text-spacing, state, and screenshot checks listed above. No browser pass is claimed by this implementation task.
