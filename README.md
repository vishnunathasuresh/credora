# Credora

Credora is an open-source credential issuance, ownership, sharing, and
independent verification system. It uses a Solidity registry for immutable
credential proofs and content-addressed metadata storage behind a replaceable
adapter.

## Workspace

- `apps/web` — Next.js web application, dashboards, and public verification.
- `apps/mobile` — Expo React Native Android application for wallet, sharing,
  and verification flows.
- `apps/api` — small TypeScript API for sessions, operational state, and
  projections. It never overrides the blockchain.
- `packages/*` — reusable protocol and application modules.
- `contracts` — independently tested Solidity source.

## Local development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm dev
```

For blockchain development, install Foundry, start Anvil, then run:

```sh
pnpm contracts:deps
pnpm anvil
# in another terminal
pnpm contracts:build
pnpm contracts:test
```

Deploy the local registry with an ephemeral Anvil key:

```powershell
$env:PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
pnpm contracts:deploy
```

Set the resulting `CREDENTIAL_REGISTRY_ADDRESS` in `.env.local` alongside
`RPC_URL=http://127.0.0.1:8545` before starting the API. The API validates
issuer authorization, confirms signed transactions against the registry, and
performs public verification from the chain plus metadata storage.

Copy `.env.example` to `.env.local` or `.env` as appropriate. The default
configuration is local-only and does not require paid RPC or storage services.

For hosted IPFS metadata, Credora uses Filebase’s Kubo-compatible IPFS RPC API.
Set the Filebase RPC credential as `IPFS_UPLOAD_AUTH_TOKEN` in `.env.local` or
your deployment secret store:

```sh
IPFS_UPLOAD_URL=https://rpc.filebase.io/api/v0/add?cid-version=1
IPFS_UPLOAD_AUTH_TOKEN=your-filebase-ipfs-rpc-token
IPFS_GATEWAY_URL=https://ipfs.filebase.io/ipfs
IPFS_REQUEST_TIMEOUT_MS=15000
```

Keep the upload token server-side; do not commit it or expose it to web/mobile
clients. Credential metadata is public on IPFS, so do not include unnecessary
personal data. Leave the IPFS variables blank for local development.

To enable the live Filebase check in GitHub Actions, add the RPC credential as
the repository secret `FILEBASE_IPFS_RPC_TOKEN`. The integration job is skipped
when that secret is absent.

## Architecture decisions

See `docs/decisions/` for the hash format, immutable record policy, storage
boundary, and API projection boundary.

## GitHub automation

Pull requests and pushes run workspace typechecking, formatting, unit tests,
production builds, Foundry contract tests, and an Anvil-backed API integration
flow through `.github/workflows/ci.yml`.

Pushes to `main` and version tags publish the API container to GitHub Container
Registry through `.github/workflows/cd.yml`. The deployment stack in `deploy/`
can consume that image from a self-hosted environment.

New pull requests request a review from GitHub Copilot through
`.github/workflows/copilot-review.yml`. Copilot code review must be enabled for
the repository or organization, and its review is advisory rather than a
required approval.
