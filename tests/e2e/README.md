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

Route failure coverage runs against the same configured API and registry. It
requires a funded unauthorized Anvil key in addition to the issuer key:

```powershell
$env:ANVIL_UNAUTHORIZED_PRIVATE_KEY = "0x..."
pnpm test:e2e:backend:routes
```

The route suite covers malformed input, missing sessions, unauthorized issuers,
metadata outages, metadata tampering, duplicate confirmations, and reverted
transactions.
