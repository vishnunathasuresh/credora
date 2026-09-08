# Credora repository map

## Runtime surfaces

- `apps/web`: Next.js public verification, dashboards, issuer, admin, and
  learner wallet flows. Browser wallet signing stays client-side.
- `apps/mobile`: Expo/React Native wallet, sharing, and verification surface;
  keep platform-specific UI here rather than forcing web primitives into it.
- `apps/api`: TypeScript operational API, sessions, role checks, projections,
  IPFS adapter, and chain-backed verification helpers. It cannot override
  registry truth.

## Reusable packages

- `packages/credential-core`: canonical hashing, normalization, v2 claims
  roots, selective-disclosure creation and verification.
- `packages/blockchain`: viem clients and chain-facing helpers.
- `packages/contracts`: ABI and contract-facing types for application code.
- `packages/storage`: metadata storage adapter and integrity checks.
- `packages/auth`: challenge/session and role-related shared behavior.
- `packages/shared`: cross-platform domain types and API contracts.
- `packages/ui`: shared UI exports and design tokens where platform-safe.
- `packages/demo-data`: clearly synthetic showcase fixtures.

## Protocol and operations

- `contracts/src`: Solidity registry source.
- `contracts/test`: Foundry contract tests.
- `tests/e2e`: Anvil-backed API, route, role, outage, and IPFS smoke tests.
- `docs/architecture`, `docs/decisions`, `docs/requirements`, `docs/glossary`:
  durable project context.

Dependency direction is one-way: apps may depend on packages; packages must
not depend on apps. Cross-platform domain logic belongs in packages, while
web/native interaction code remains in its app.
