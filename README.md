# Credora

Credora is an open-source credential issuance, ownership, sharing, and
independent verification system. It uses a Solidity registry for immutable
credential proofs and content-addressed metadata storage behind a replaceable
adapter.

## Workspace

- `apps/web` — Next.js web application, dashboards, and public verification.
- `apps/mobile` — Expo React Native / Tamagui holder and verifier for saved links, sharing,
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

`pnpm dev` starts the website and API only. Run `pnpm dev:mobile` explicitly
to open the Expo holder/verifier app.

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
# Optional trusted bootstrap override; use reviewed requests for normal onboarding.
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

### Organization onboarding

An applicant opens `/org`, connects a wallet, and submits an organization name
and its self-reported HTTPS website. Credora stores one pending request for
that wallet. A superadmin scans the resulting QR to open the protected request
in `/superadmin`, independently checks the organization and applicant wallet,
then explicitly approves or rejects it. The applicant can download and share a
QR that contains only a random request reference; it does not grant access.
The API rejects duplicate pending requests
and every review action is role-gated and audited.

Approval grants `ORG_ADMIN` to that applicant wallet in the API-backed
organization record. It does not authorize credential issuance. The same
wallet must separately be authorized as an issuer on the configured registry
by a superadmin before it can issue. Superadmins can suspend or reactivate
organization access; a suspension takes effect on the next API request.
Suspension does not revoke the wallet’s on-chain issuer authorization; revoke
that separately from the superadmin issuer controls if the wallet must stop
issuing as well.
Enrollment records require the API SQLite database to persist and be backed
up. This v1 flow records one organization admin wallet and does not yet invite
additional organization team members. For a phone to scan a local-development
QR, open Credora at a LAN-reachable host/IP before generating it; production
deployments must use HTTPS.

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
Registry through `.github/workflows/cd.yml`. The self-hosted web/API deployment
stack, environment template, and HTTPS proxy configuration live in `deploy/`;
the workflow publishes an image but does not deploy to a hosting server.

New pull requests request a review from GitHub Copilot through
`.github/workflows/copilot-review.yml`. Copilot code review must be enabled for
the repository or organization, and its review is advisory rather than a
required approval.

## Wallet setup and mobile credentials

You do not need a wallet to verify a credential. On the website, open `/verify`
and paste a public verification link or hash. The mobile verifier also accepts
links and scans public credential QR codes.

To find credentials issued to your wallet address:

1. Install an Ethereum-compatible wallet from its [official website](https://metamask.io/download/)
   and follow its account and backup instructions. Never enter a recovery phrase
   or private key in Credora. [MetaMask setup guidance](https://support.metamask.io/start/creating-a-new-wallet)
   explains its supported account creation options.
2. Copy your public `0x` address and give it to the issuer before issuance.
3. Open `/wallet` in the desktop browser with the wallet extension, or in your
   wallet app’s browser on mobile. Connect and approve the login message. This
   signs a message, not a transaction, and costs no gas.
4. Open a credential’s verifier or Share QR. Anyone can check its public record.

Issuers need an authorized address and the configured network to issue. For
local Anvil development, use chain ID `31337`, currency `ETH`, and RPC
`http://127.0.0.1:8545` on the same computer. A phone needs a reachable LAN RPC
address instead. Anvil’s funded development accounts are public test accounts;
use a separate development wallet and never fund these accounts on a public chain.
The API/registry configuration determines which issuer addresses are authorized.
Creating a wallet does not grant an issuer or administrative role.

The mobile app has Credentials, Verify, and Setup tabs. It stores public
references and display names on the device, presents verified details in a
credential card, and can group selected credentials into one expiring QR
(1, 7, or 30 days). The QR resolves through the API; the verifier then checks
each credential against its public record. It does not prove the presenter
controls the learner wallet, and a copied QR or public record cannot be
recalled. The native share action exports the QR as a PNG image. Credential
cards use a small native WebGL artwork header on Android
and iOS, with a static fallback in the browser preview. The app exports public
credential JSON after a fresh service-backed check. Saved links and exported
copies are not offline proofs.
Original PDF/image attachment downloads are not part of the current metadata
model. Native signing-wallet integration is not included; use the web holder
flow to obtain your issued credential links.

```sh
pnpm dev:mobile
# Browser preview of the same Tamagui UI:
pnpm --filter @credora/mobile web
# Reproducible native JS bundle checks, without building an installable app:
pnpm --filter @credora/mobile exec expo export --platform android --platform ios
```

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL`, or edit the server addresses
in the app’s Setup tab. For Expo Go on a physical phone, both devices must be on
the same network and the API must listen on a reachable interface. `localhost`
on the phone refers to the phone. Use an externally reachable website URL for
QR codes shared outside your development network; use HTTPS for deployed services.
Camera access is requested only when Scan is chosen. If permission is denied,
paste a link instead. An unavailable API, ledger, metadata source, or device
storage has a distinct message and never marks a credential invalid.

Validation scope and open device checks: [UI/UX audit](docs/ux/ui-ux-audit.md).
