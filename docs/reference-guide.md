# Reference guide

## Evidence model

| Field | Meaning | Missing value |
| --- | --- | --- |
| `identity_verified` | A reviewer has verified the organization. | Pending. |
| `product_match` | The normalized demand matches the product. | Pending. |
| `contact_verified` | A contact route was independently verified. | Pending. |
| `source_matched` | The quote was checked against source content. | Pending. |
| `published_on` | Publication date, not retrieval date. | Pending. |
| `closes_on` | Deadline supplied by a source. | Unknown; never inferred. |
| `kind` | RFQ, project opportunity, or another signal. | Pending. |

The public classifier trusts the first four normalized flags because they are fixed fixtures. It does not fetch or authenticate their evidence. A production adapter must attach source snapshots and reviewer provenance; a model or plausible-looking page must not set these flags by itself.

Classification uses a fixed as-of date from `sample.fake.json`. A complete, recent, unexpired `rfq` becomes `explicit`; a complete `project` becomes `opportunity`; missing checks, catalogs, future dates, stale publications, and expired demand become `pending`. `procurement_authority` remains `unknown`, and `outreach_sent` remains `false`.

## Local API

| Method and path | Request | Effect |
| --- | --- | --- |
| `GET /api/state` | None | Return synthetic records and queue snapshot. |
| `POST /api/enqueue` | `product`, `request_id` | Save a demo label; reused IDs are idempotent. |
| `POST /api/pause` | Empty JSON object | Prevent next-item processing. |
| `POST /api/resume` | Empty JSON object | Permit manual next-item processing. |
| `POST /api/next` | Empty JSON object | Complete one FIFO demo row atomically. |
| `POST /api/cancel` | `id` | Cancel a queued row only. |

Rows can be queued, completed, cancelled, or interrupted. Recovery requires manual inspection; there is no background research, automatic retry, or interrupted-task resume.

## Safe extension order

1. Add source adapters with explicit publication and deadline extraction.
2. Attach checked quotes, immutable snapshots, contact provenance, and reviewer identity.
3. Validate against known catalogs, stale requests, and misidentified companies.
4. Add a bounded worker with budgets, confirmed cancellation, and recovery events.
5. Add authentication and authorization before hosting; keep contacts and sales feedback private.

The included tests verify public classification, queue, HTTP, and boundary contracts. They do not measure research accuracy, model quality, outreach, or sales outcomes.
