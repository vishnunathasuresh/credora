# End-to-end coverage

The first E2E harness should exercise the web verification flow against a
local API and Anvil registry:

```text
create issuance → upload metadata → submit proof → confirm → verify publicly
```

Keep wallet signing behind a test adapter so the happy path is deterministic;
retain one browser smoke test for the real wallet boundary before release.

The local backend smoke test exercises the full Anvil path. Start Anvil and the
API with the deployed registry configured, then run:

```sh
pnpm test:e2e:backend
```
