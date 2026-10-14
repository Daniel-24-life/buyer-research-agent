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

Expected result: 13 Python tests pass and the JavaScript syntax check exits with code 0. The tests use temporary SQLite databases and require no network access.

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

This verifies the offline fixture and manual queue only. It does not verify real research, fetching, models, contacts, outreach, orders, or the excluded private execution chain.
