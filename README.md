# Credora

Credora issues, holds, shares, and independently verifies credentials. A
Solidity registry is authoritative for credential proofs; IPFS stores public
metadata; the API keeps a rebuildable projection for sessions and product
workflows.

## Start locally

Requirements: Node.js 22 and pnpm 10.32.1 (the version pinned by this repo).

```sh
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile
[ -f .env.local ] || cp .env.example .env.local
[ -f apps/web/.env.local ] || cp .env.example apps/web/.env.local
pnpm dev
```

Open <http://localhost:3000>. The API listens on port 4000. The `/demo` catalog
contains clearly labelled synthetic records; it does not represent real
issuances. Without a reachable registry, public-chain verification and
issuance remain unavailable. See [local development setup](docs/setup/local-development.md)
for environment details and [all setup guides](docs/setup/README.md) for other
workflows and user roles.

## Applications

- `apps/web` — issuer, holder, organization, administration, and public verifier
  flows built with Next.js.
- `apps/mobile` — Expo holder and verifier for saving public links, scanning QR
  codes, checking credentials, and sharing selected records.
- `apps/api` — wallet sessions, organization workflows, sharing, audit, and
  chain/IPFS-backed verification. It never overrides the registry.
- `contracts` — Solidity registry and Foundry scripts.
- `packages/*` — shared protocol, storage, auth, and UI modules.

## Choose a setup guide

| Goal                                                   | Guide                                                |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Run the web app and API                                | [Local development](docs/setup/local-development.md) |
| Run Anvil and the local registry                       | [Blockchain development](docs/setup/blockchain.md)   |
| Use the Expo mobile app                                | [Mobile setup](docs/setup/mobile.md)                 |
| Set up as a verifier, holder, issuer, or administrator | [User roles](docs/setup/user-roles.md)               |
| Host Credora yourself                                  | [Production setup](docs/setup/production.md)         |
| Diagnose common local failures                         | [Troubleshooting](docs/setup/troubleshooting.md)     |

## Trust and demo data

Credential hashes use versioned Keccak-256 and are distinct from IPFS CIDs.
The registry proves credential existence, issuer, learner, and metadata URI;
IPFS serves the metadata bytes. API and SQLite records are projections that
can be rebuilt. Issued v1 credentials are immutable. Demo fixtures are
synthetic and must not be presented as issued or independently verified
credentials.

Read the [architecture overview](docs/architecture/overview.md) and
[protocol decisions](docs/decisions/) for the full model. The
[self-host deployment guide](deploy/README.md) documents domains, TLS,
persistent storage, backups, and production configuration.

## Project checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Contract checks require Foundry; API integration checks additionally require
Anvil. See [blockchain development](docs/setup/blockchain.md) and the
[contracts guide](contracts/README.md).
