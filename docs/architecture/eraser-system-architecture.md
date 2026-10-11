# Credora system architecture — Eraser generation specification

Paste the specification below into Eraser's AI diagram generator.

## Diagram brief

Generate a system architecture diagram titled **Credora — Verifiable Credential System**. Show the current repository architecture and its self-hosted deployment topology. Use a left-to-right layout, explicit trust boundaries, short component descriptions, and labeled directional arrows. Emphasize the two independent paths: wallet-signed issuance and public verification from the blockchain registry plus content-addressed metadata.

Represent logical API modules inside one Node.js service; they are not separately deployed microservices. Represent shared packages as an inset of libraries, not network services. Do not invent infrastructure or product features.

## Groups and components

### 1. Users and client-controlled devices

- **Issuer / organization administrator:** prepares credentials and approves issuance transactions with an authorized wallet. Organization administration and on-chain issuer authorization are separate permissions.
- **Learner / holder:** receives credential references, saves them in a local library, and shares selected public credentials through QR links.
- **Verifier:** opens a credential reference or scans a share QR; public credential verification requires no Credora login.
- **Superadmin / registry administrator:** reviews organization applications through the API; a registry administrator separately signs issuer-authorization transactions. These responsibilities can belong to different wallets.
- **Browser wallet:** external signing boundary connected to the web app. Holds signing keys and signs authentication messages and blockchain transactions. Keys never enter Credora's API, database, or contracts.
- **Next.js web application (`apps/web`):** public verification, learner library and sharing, issuer workspace, organization enrollment, and admin review. Include an internal **direct verification fallback** module that reads RPC and the IPFS gateway without the Credora API. This module executes within the web application, not a separate verifier service.
- **Expo / React Native Android application (`apps/mobile`):** credential library, QR scanning, public verification through the API, and selected-credential sharing. Include **device-local storage** for saved references and share management capabilities. Do not draw a mobile direct-RPC fallback or mobile issuance wallet integration as currently implemented.
- **Independent verifier:** an external tool that reads the configured registry and IPFS gateway directly; it does not depend on Credora sessions or its database.

### 2. Self-hosted Credora application boundary

- **Caddy HTTPS reverse proxy:** terminates HTTPS; routes the main domain to the Next.js web service on port 3000 and `api.<domain>` to the API service on port 4000. Public API requests from both apps pass through this boundary.
- **Node.js / TypeScript API (`apps/api`):** one service with the following internal modules:
  - **Wallet authentication and access control:** expiring nonce challenge, wallet-signature verification, one-time challenge consumption, bearer sessions, current organization status checks, and role enforcement.
  - **Organization enrollment and review:** application intake, explicit superadmin approval/rejection, active/suspended organization records, and organization-scoped operational views.
  - **Issuance coordinator:** persists drafts, uploads public metadata, computes canonical credential hashes, checks issuer authorization, and validates submitted transaction receipts and transaction fields. It does not sign issuance transactions.
  - **Public verification:** reads the registry, retrieves metadata, recomputes the v1 credential hash, and checks the manifest against the chain-bound record.
  - **Wallet share capabilities:** creates expiring immutable selections of 1–25 credential hashes, resolves bearer links, and accepts revocation through a separate management secret. Stores SHA-256 digests of share and management tokens rather than raw capability tokens.
  - **Chain projection synchronizer:** runs periodically inside the API process; scans `CredentialIssued` logs in bounded chunks, applies confirmation depth, rescans a bounded reorg window, and records provenance and synchronization progress.
  - **Operational controls:** rate limiting, CORS, audit logs, expiry cleanup, health/readiness endpoints, and metrics.
- **Persistent SQLite database (`node:sqlite`):** draw two logical compartments within one database:
  - **Operational records requiring backups:** organization applications and review decisions, organization profiles/status, issuance drafts, authentication challenges/sessions, share capabilities/selections, and audit records.
  - **Rebuildable chain projections:** issuance/event views and synchronization cursor; retain credential hash, block number/hash, transaction hash, and log index where available. These views are eventually consistent and cannot override blockchain proof.
- **Persistent Docker volume (`credora-data`):** backs the SQLite database, local metadata directory, and backup directory. Do not imply this volume hosts the production IPFS network.
- **SQLite backup job (`db-backup` container):** periodically snapshots SQLite to the backup directory on the same volume. Annotate that this is the repository's local rotating backup arrangement, not a depicted remote disaster-recovery service.

### 3. Public blockchain boundary

- **Configured EVM JSON-RPC endpoint:** receives read calls and wallet-signed transactions; connects to the selected blockchain network. No specific hosted provider is required. Local development uses Anvil.
- **Solidity `CredentialRegistry` contract:** OpenZeppelin AccessControl; `DEFAULT_ADMIN_ROLE` manages `ISSUER_ROLE`. Stores immutable records keyed by a 32-byte credential hash: issuer address, learner address, metadata URI, block issuance timestamp, and existence flag.
- Show the contract operations `setIssuerAuthorization`, `issueCredential`, and `getCredential`, plus the `CredentialIssued` event.
- Label the registry **Authoritative credential records and issuer authorization**. It stores hashes and references, not complete manifests, organization profiles, private keys, or learner identity documents.

### 4. Content-addressed metadata boundary

- **IPFS upload/pinning endpoint:** accepts public JSON manifests from the API storage adapter and returns a CID. Upload credentials remain server-side.
- **IPFS content-addressed storage:** holds manifest bytes addressed by their CID.
- **IPFS HTTP gateway:** retrieves manifests from `ipfs://<CID>` references for the API, web fallback, and independent verifier.
- Label this boundary **Content-addressed metadata bytes**. The credential's versioned Keccak-256 hash binds the canonical payload, including its metadata URI, to the registry record. An IPFS CID is not the credential hash.

## Required connections

Draw these connections with clear arrowheads and labels. Request/response connections may be bidirectional; transaction submission and event ingestion must retain their actual direction.

1. Users → web or mobile: **credential workflows / QR scan**. Issuers and admins operate through the web app; holders and verifiers may use either app.
2. Web app ↔ browser wallet: **connect / sign challenge / approve transaction**.
3. Web users ↔ Caddy ↔ Next.js web service: **HTTPS pages and application requests**.
4. Web app and mobile app ↔ Caddy ↔ API: **HTTPS JSON — sessions, drafts, review, library discovery, shares, verification**.
5. Authentication module ↔ SQLite: **nonce challenges and bearer sessions**. Browser wallet → web app → authentication module: **signed challenge; no private key**.
6. API operational modules ↔ SQLite operational compartment: **persistent operational state and audit**.
7. Issuance coordinator → IPFS upload endpoint → IPFS storage: **public manifest upload**; label the response **CID → metadata URI**.
8. API blockchain adapter ↔ RPC ↔ registry: **issuer/admin reads, credential lookup, receipt validation**.
9. Browser wallet → RPC → registry: **signed issuance / issuer authorization transaction**. Do not route signing through the API.
10. Registry events → RPC log retrieval → API synchronizer → SQLite projection compartment: **confirmed logs → rebuildable projections**. This is polling, not a message queue.
11. API verifier ↔ IPFS gateway ↔ IPFS storage: **retrieve manifest by CID**.
12. Web direct verification fallback and independent verifier ↔ RPC and IPFS gateway: **API-independent proof reads**. These paths bypass the API and SQLite; the web fallback remains part of the web service.
13. Mobile application ↔ device-local storage: **saved references / share management capability**.
14. Share module ↔ SQLite operational compartment: **token digests, fixed ordered hash selection, expiry/revocation**. Verifier → share resolution → ordinary credential verification: **resolve references, then verify each proof**.
15. SQLite backup job → database → backup directory: **snapshot persistent operational data**.

## Numbered flow overlays

Use compact numbered callouts instead of duplicating the architecture nodes.

**A. Credential issuance**

1. Issuer connects a wallet, signs an authentication challenge, and obtains an API session.
2. API checks on-chain issuer authorization and saves a credential draft.
3. API uploads the v1 public manifest, receives its CID/URI, and computes the versioned Keccak-256 credential hash using canonical ABI encoding.
4. Web app asks the issuer wallet to sign `issueCredential(hash, learner, metadataUri)`; the wallet submits the transaction through RPC.
5. Contract enforces issuer authorization and duplicate-hash protection, stores the immutable record, and emits `CredentialIssued`.
6. Web app submits the transaction hash to the API. API checks the receipt and transaction bindings; periodic synchronization maintains the chain-derived projection. Pending or failed operations must remain distinguishable from confirmed issuance.

**B. Public credential verification**

1. Parse the credential reference and select the configured chain/registry.
2. Read `getCredential(hash)` from the registry through RPC.
3. Retrieve the manifest using the record's metadata URI.
4. Normalize canonical fields, recompute the versioned hash, and compare the hash and bound issuer/learner fields against the record.
5. Return a verification result. An API row, organization logo, or QR lookup alone cannot establish validity. The web fallback and independent verifier can perform this path without the API; the current mobile client uses the API.

**C. Organization approval and sharing**

- Organization approval creates an operational organization record and `ORG_ADMIN` access. Registry issuer authorization remains a separate signed administrative transaction. Suspending an organization does not revoke that on-chain authorization.
- A holder selects 1–25 public credential references and an expiry of 1, 7, or 30 days. The API returns a bearer share token and a separate revocation capability. The QR resolves a fixed list of references; each credential is verified independently. Expiry/revocation stops future bundle lookup but cannot remove public proofs or existing copies.

## Shared-library inset

Show dashed dependency lines from applications to these reusable libraries. Label the inset **Build-time dependencies; not deployed services**:

- `credential-core`: canonical normalization, v1/v2 hashing, salted Merkle claim commitments, and selective-disclosure presentation helpers.
- `blockchain`: viem-based registry/RPC adapter.
- `contracts`: ABI and contract-facing application types.
- `storage`: metadata storage interface and IPFS/file adapters.
- `auth`: wallet challenge/signature helpers.
- `shared`: domain types and API contracts.
- `ui` and `config`: platform-safe shared UI/tokens and tooling configuration; web and native interaction components stay in their own apps.
- `demo-data`: synthetic fixtures, visually separated from real proofs.

Applications depend on packages; packages never depend on applications. Do not imply that every application imports every package.

## Trust, status, and version annotations

- Use green for authoritative proof resources, blue for client/application services, amber for operational database state and projections, and gray for development-only or protocol-library notes.
- Solid arrows denote runtime traffic; dashed arrows denote library dependencies or explicitly conditional fallback paths. Include a legend.
- Credential signing keys remain in the external wallet. Keep unnecessary PII out of the API, contract, and public manifest. V1 manifest fields are public; sharing does not selectively conceal them.
- Distinguish `malformed`, `not-found`, `ledger-unavailable`, `metadata-unavailable`, `metadata-invalid`, and `valid`. An API/service outage is an availability failure, not an invalid credential. Do not suggest every implementation currently classifies malformed JSON and proof mismatch separately; these are distinct causes within the metadata failure boundary.
- Existing v1 issued records have no edit/delete/revocation flow. Future credential revocation, holder recovery, and rotation require append-only protocol work. Share revocation is separate from credential revocation.
- The v1 payload's declared issue date participates in hashing; the registry's `issuedAt` is the transaction block timestamp. Do not merge these into one timestamp or imply the contract recomputes the manifest hash.
- V2 selective disclosure is implemented in `credential-core`: a credential hash commits to a salted Merkle claims root; presentations reveal selected values and proofs. Draw this only as a protocol-library note, not a shipped end-to-end issuance/verification service. Hidden values and salts stay holder-local. This is not a zero-knowledge proof and does not prove presenter wallet control.
- Local development may use Anvil and file-backed `local://` metadata. Label that adapter **Development only; not IPFS**. Production uses configured external RPC, deployed registry, and IPFS upload/gateway endpoints.
- Do not add NFTs, tokens, an organization smart contract, custodial signing, Kafka, Redis, PostgreSQL, Kubernetes, or a separate indexing service. None is required by the current architecture. Synthetic demo fixtures are not live verification evidence.

## Repository basis

This is a diagram-generation brief, not a new architecture decision or proof of a running production deployment. The maintained boundaries and decisions remain authoritative:

- [Architecture overview](overview.md)
- [ADR 0001: Protocol boundaries](../decisions/0001-protocol-boundaries.md)
- [ADR 0002: Credential hashing](../decisions/0002-credential-hash.md)
- [ADR 0006: Projections and independent verification](../decisions/0006-rebuildable-projection-and-verification.md)
- [ADR 0007: Selective disclosure](../decisions/0007-selective-disclosure-v2.md)
- [ADR 0008: Organization enrollment](../decisions/0008-reviewed-organization-enrollment.md)
- [ADR 0009: Wallet shares](../decisions/0009-expiring-selected-wallet-shares.md)
- Implementation: `apps/api/src/index.ts`, `apps/api/src/migrations.ts`, `apps/web/src/components/issuer-workspace.tsx`, `apps/web/src/lib/verification-api.ts`, `apps/web/src/lib/direct-verification.ts`, `apps/mobile/src/credentials.ts`, `packages/credential-core/src/index.ts`, `packages/blockchain/src/index.ts`, `packages/storage/src/index.ts`, and `contracts/src/CredentialRegistry.sol`.
- Deployment: `deploy/docker-compose.yml` and `deploy/Caddyfile`.
