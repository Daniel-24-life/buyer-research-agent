# Verification

## Prerequisites

- Python 3.11 or later
- Node.js 22 (syntax check only; the app has no Node dependencies)

## Automated checks

Run from the repository root:

```powershell
python -B -m unittest discover -s tests -v
node --check dist/app.js
```

Expected result: 19 Python tests pass and the JavaScript syntax check exits with code 0. The tests use temporary SQLite databases and require no network access. UI contract checks cover initial write locks, semantic landmarks, connection-state/retry hooks, idempotency-key handling, requested palette/type tokens, and selected-detail fields.

## Manual local check

```powershell
python server.py
```

Open <http://127.0.0.1:4182>, then:

1. Confirm four records and three classifications are visible.
2. Add two task labels. Pause the queue and confirm the next-step button is disabled.
3. Resume and complete exactly one row; confirm only the first queued row changes.
4. Cancel the remaining queued row.
5. Restart the server and confirm persisted state remains.
6. Export JSON and confirm `synthetic` is `true` and all source hosts end in `.invalid`.
7. Stop the server after loading the page, wait for the stale state, and confirm every write control is disabled; use retry before and after restarting the service to confirm error and ready recovery.
8. At 320, 375, 768, and 1440 CSS px, confirm the reading order is filters, records, selected detail, then supporting operations, with no page-wide horizontal scrolling.
9. Complete a keyboard-only pass, 200% text resize, WCAG text-spacing override, and visible-focus check. Record browser screenshots only after each tested state is stable.

The automated checks verify source and offline behavior only. Browser layout, accessibility-tree, keyboard, zoom, and screenshots remain manual QA and must not be reported as passed until performed. Nothing here verifies real research, fetching, models, contacts, outreach, orders, or the excluded private execution chain.
