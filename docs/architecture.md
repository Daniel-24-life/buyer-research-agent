# Architecture

```text
browser workbench
  -> loopback JSON API
  -> SQLite demo queue (FIFO / pause / cancellation / request ID)
  -> fixed synthetic records
  -> evidence classifier
  -> separated classes and missing checks
  -> human review / JSON export
```

## Runtime contracts

The browser receives four fixed records from `sample.fake.json`. `core.classify` applies normalized evidence gates against the fixture's fixed as-of date. It never infers a missing verification value. Publication freshness and deadline validity are separate checks, and procurement authority remains unknown for every category.

The queue stores task labels and state only. Processing a row is one atomic SQLite transaction. Reusing a request ID with the same label returns the original row; reusing it with another label is rejected. A restart preserves queue state, marks any former running row as interrupted, and does not execute work.

`server.py` binds to `127.0.0.1`, serves only three allowlisted static files, limits JSON request size, and rejects browser POST requests from a foreign origin. It is a local demonstration server, not a hosted multi-user authorization layer.

## Deliberately absent execution

The queue is manual and one-step: `/api/next` marks one queued row complete. There is no worker, scheduler, subprocess, CLI research, automatic retry, network request, model call, paid execution, or real buyer operation.

An actual research adapter would need to supply fetched source text, verified dates, company identity, contact provenance, audit snapshots, budgets, cancellation, and recovery events. That private execution chain, its data, and its history are excluded from this public repository.

All displayed organizations, evidence and dates are synthetic fixtures. All source hosts end in `.invalid`, so they are intentionally non-contactable and do not imply platform affiliation.
