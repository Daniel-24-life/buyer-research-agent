# Source reading guide

This repository is intentionally small. A useful reading order is:

1. Start with [`sample.fake.json`](../sample.fake.json) to see the four fixed fixtures, the fixed `asof` date, and `.invalid` source domains.
2. Read [`core.py`](../core.py): `classify` contains the evidence gates; `Queue` contains persistence, FIFO, pause, idempotency, cancellation, and restart handling.
3. Read [`tests/test_core.py`](../tests/test_core.py) beside the core. Its nine tests document missing evidence, dates, catalogs, queue order, cancellation, and interruption.
4. Read [`server.py`](../server.py) and [`tests/test_server.py`](../tests/test_server.py). The four HTTP tests cover the static allowlist, origin check, malformed JSON, and synthetic/idempotent API state.
5. Read [`dist/index.html`](../dist/index.html), [`dist/app.js`](../dist/app.js), and [`dist/styles.css`](../dist/styles.css) for the no-build browser workbench.
6. Finish with [`architecture.md`](architecture.md) and [`reference-guide.md`](reference-guide.md) for boundaries and extension guidance.

The important negative contract is as valuable as the code: input does not trigger fetching; flags are fixed fixtures; queue processing is a manual local state transition; there is no real research, model, outreach, or private execution chain here.
