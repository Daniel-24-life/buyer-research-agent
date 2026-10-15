<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/cover-dark.svg" />
  <img src="docs/assets/cover-light.svg" alt="buyer-research-agent" width="1280" />
</picture>

# Buyer Research Agent

[Portfolio](https://github.com/Daniel-24-life/AIfile)

An independently runnable offline reconstruction of a buyer-research workbench. It demonstrates demand classification with fixed synthetic evidence and persists a local task queue in SQLite.

![Synthetic buyer workbench](docs/assets/workbench-desktop.png)

## Run

Python 3.11 or later is required. There are no third-party packages, credentials, or model dependencies.

```powershell
python server.py
```

Open <http://127.0.0.1:4182> and start in the demand classification and evidence workspace. Use `python server.py --port 4184` to choose another port. The server binds only to loopback and stores SQLite state under the ignored `.runtime/` directory.

## What this demonstrates

- Four invented lighting records separated into explicit demand, project opportunity, and pending evidence.
- A master-detail review path that keeps the selected quote, dates, missing checks, and next action together.
- A durable FIFO demo queue with pause, cancellation, restart persistence, and idempotent request IDs.
- Manual one-step processing: one click completes one local row.
- Explicit loading, ready, error, and stale connection states, with retry and write controls disabled until a valid connection is ready.
- Synthetic JSON export and 19 standard-library `unittest` tests.

Product input changes only the saved task label. It does not fetch sources or create new research results. Verification flags are fixed fixtures, and every source uses a non-contactable `.invalid` domain.

If a create request fails, the entered value and idempotency key are retained for a safe retry after reconnection.

## Boundaries

This repository performs no real buyer research, web fetching, model invocation, contact discovery, outreach, email delivery, order validation, or background execution. Real customers, contacts, research reports, prompts, execution history, and the private execution chain are excluded.

Procurement authority always remains unknown. A catalog match is not purchase intent; a project notice remains an opportunity; missing or expired evidence stays pending.

See [architecture](docs/architecture.md), [reference guide](docs/reference-guide.md), [source reading guide](docs/SOURCE_READING_GUIDE.md), [UI audit](docs/UI_AUDIT.md), [verification](docs/VERIFICATION.md), and [migration provenance](MIGRATION.md).

```powershell
python -B -m unittest discover -s tests -v
node --check dist/app.js
```

Public upstream: [Daniel-24-life/AIfile](https://github.com/Daniel-24-life/AIfile).
