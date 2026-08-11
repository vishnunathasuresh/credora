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
pnpm contracts:build
pnpm contracts:test
```

Copy `.env.example` to `.env.local` or `.env` as appropriate. The default
configuration is local-only and does not require paid RPC or storage services.

## Architecture decisions

See `docs/decisions/` for the hash format, immutable record policy, storage
boundary, and API projection boundary.
