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

`pnpm dev` starts the website and API only. The Expo/mobile app is paused while
the website MVP is being completed; run `pnpm dev:mobile` explicitly when that
work resumes.

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

For the Next.js website, set the public browser-wallet configuration in
`apps/web/.env.local`:

```sh
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://ipfs.filebase.io/ipfs
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS=0xYourDeployedRegistry
```

If the API is unavailable, the website uses the RPC and public gateway values
to verify the registry record directly. Local `local://` metadata remains
available through the API only; production verification should use IPFS-backed
metadata for an independently recoverable path.

Role configuration stays server-side:

```sh
API_SUPERADMIN_ADDRESSES=0xProtocolAdmin
API_ORG_ADMIN_ADDRESSES=0xOrganizationOperator
```

The registry itself remains authoritative for `SUPERADMIN` and `ISSUER`
authority. `ORG_ADMIN` is an operational organization role; it does not bypass
the on-chain issuer authorization check.

Open `/dashboard` to see the tools available to the connected wallet. A
superadmin can open `/superadmin` to authorize an issuer, an organization admin
can open `/org` to manage organization operations, and an issuer can open
`/issuer` to issue a credential. Open `/wallet` from the learner wallet to see
confirmed credentials and copy a public `/verify/<credential-hash>` link. The
browser wallet signs the session challenge and the issuance transaction;
private keys are never sent to the API.

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

## Architecture decisions

See `docs/decisions/` for the hash format, immutable record policy, storage
boundary, and API projection boundary.

## Showcase data

The web app includes `/demo`, a catalog of synthetic engineering-education
organizations for IIT Bombay, NIT Trichy, IIIT Kottayam, NIT Calicut, and IIT
Palakkad. Each organization includes sample courses, certifications, fictional
learners, wallet addresses, skills, grades, and marks. The API exposes the same
catalog at `GET /demo/catalog`. These fixtures are explicitly not official
credentials, courses, certifications, or affiliations. A record becomes
verified only after a real testnet issuance transaction and Filebase/IPFS
metadata upload.

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
