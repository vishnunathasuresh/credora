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

## Architecture decisions

See `docs/decisions/` for the hash format, immutable record policy, storage
boundary, and API projection boundary.
