# Credora project presentation

Content follows the six sections in `Project Presentation Template.pptx`.
Replace the cover placeholders with the presenters' names and team number.

## Slide 1 — Project title

### Credora
**Portable credentials with independently verifiable proof**

Presented by: **[Group member names]**<br>
Indian Institute of Information Technology Kottayam<br>
Team number: **[Team number]**

*Keep the cover minimal. Add names and team number before presenting.*

## Slide 2 — Introduction

### What Credora does

Credora gives organizations a way to issue digital credentials, holders a way to carry and share them, and verifiers a public way to check their authenticity.

- A registry contract anchors each credential hash and its issuer, learner, metadata URI, and issue time.
- Public metadata carries the credential details. A verifier recomputes the hash to check that those details match the registry.
- The API supports sessions, issuer workflows, search, audit, organization access, and temporary sharing. Its chain-derived records can be rebuilt.
- Web and mobile interfaces support holders and verifiers. Issuance and administration run on the web.

**Implementation status:** Core web issuance and verification have implemented code paths. The full product is not release-complete: native device checks and authenticated organization workflow evidence remain open. Selective disclosure is implemented in the shared protocol package, but is not wired into the end-user issuance and verification flows.

**Presenter cue:** Credora separates proof from product conveniences. A verifier can check public proof without trusting a Credora account or database.

**Evidence:** `apps/web/src/components/issuer-workspace.tsx`, `apps/api/src/index.ts`, `contracts/src/CredentialRegistry.sol`, `apps/mobile/App.tsx`, `packages/credential-core/src/index.ts`.

## Slide 3 — Problem statement and objectives

### Problem

Credentials kept in a single institution's database are difficult to carry between services and difficult for an outside verifier to check independently. A database outage or a changed record can also leave the verifier unsure whether a credential is invalid or simply unavailable.

### Objectives

1. Let an authorized issuer create a credential whose proof can be checked against a public registry.
2. Let a holder share a public credential reference without giving an issuer or verifier a private key.
3. Let a verifier distinguish a missing credential, an invalid proof, and unavailable infrastructure.
4. Keep the application API replaceable for chain-derived data while retaining the operational records the product needs.
5. Limit public metadata to credential information needed for verification.

### Scope boundary

Issued v1 credentials are immutable. The current contract has no revocation or correction mechanism. Organization approval grants operational website access; it does not prove legal identity or authorize a wallet to issue on-chain.

**Evidence:** `contracts/src/CredentialRegistry.sol`, `apps/api/src/index.ts`, `apps/web/src/lib/verification-api.ts`, `apps/web/src/lib/direct-verification.ts`.

## Slide 4 — Requirements: functional and non-functional

### Functional requirements and implementation

| Requirement | Implemented behavior |
| --- | --- |
| Wallet authentication | API issues a nonce challenge; the browser wallet signs it; the API verifies the signature and creates an expiring session. |
| Issuer authorization | The registry admin grants the on-chain issuer role. The API checks that role before it creates an issuance draft. |
| Credential issuance | Web flow creates a draft, stores metadata, computes the hash, asks the wallet to submit the registry transaction, then checks its receipt and stored record. |
| Public verification | Verifier reads the registry, loads metadata, recomputes the versioned hash, and checks issuer and learner bindings. |
| Holder sharing | Web and mobile can share public links; a selected set can be shared through a fixed, expiring QR bundle. Each credential still receives an ordinary proof check. |
| Operations and roles | API supports organization applications and review, role-gated dashboards, audit records, chain-event projection and reconciliation. |
| Mobile holder/verifier | Expo app stores public references locally, scans credential or share QR codes, calls the verification service, and exports public JSON. |

### Non-functional requirements

- **Proof integrity:** Keccak-256 over canonical, versioned fields. An IPFS CID identifies metadata bytes; it is not the credential hash.
- **Privacy:** Signing keys stay in the user's wallet. Avoid unnecessary personal information in public metadata.
- **Honest failure states:** Malformed input, absent record, ledger outage, metadata outage, and proof mismatch have distinct results.
- **Replaceable projections:** Chain-derived issuance rows can be reconstructed from registry events; organization applications and access decisions remain API records.
- **Self-hosting:** Local Anvil and file storage support development; production Compose config provides web, API, HTTPS proxy, SQLite volume, and scheduled backups.

### Completion check

The core web proof path is implemented. End-to-end organization application/review evidence and native device QA remain open. v2 selective-disclosure helpers have package-level implementation, but normal issuance, API verification, web direct verification, and mobile metadata parsing currently follow the v1 public-manifest format. The repository contains unit and integration suites for hashing, storage, contracts, API routes, roles, outages, and selected shares; release evidence for the open workflows is still needed.

**Evidence:** `packages/credential-core/src/index.ts`, `apps/api/src/index.ts`, `apps/mobile/src/credentials.ts`, `tests/e2e/`, `docs/ux/finish-review.md`.

## Slide 5 — System architecture

### Component and trust boundaries

```mermaid
flowchart LR
  subgraph Clients
    Issuer[Issuer web app<br/>wallet signs and sends transaction]
    Holder[Holder web app]
    Mobile[Expo holder and verifier]
    Verifier[Public web verifier]
  end

  subgraph Shared[Shared packages]
    Core[credential-core<br/>normalization and Keccak hashes]
    Chain[blockchain and contract ABI]
    Storage[storage adapters]
    Auth[wallet challenge verification]
    Types[shared domain types]
  end

  API[Credora API<br/>sessions, roles, issuance workflow, verification, shares]
  DB[(SQLite<br/>sessions, operations, org access, audit, projections)]
  Registry[(CredentialRegistry<br/>authoritative v1 proof record)]
  Metadata[(IPFS metadata<br/>public bytes addressed by CID)]

  Issuer -->|HTTPS API| API
  Issuer -->|wallet transaction| Registry
  Holder --> API
  Mobile -->|API verification and sharing| API
  Verifier -->|verification request| API
  Verifier -.->|fallback: direct read| Registry
  Verifier -.->|fallback: gateway fetch| Metadata
  API --> DB
  API -->|read, role checks, transaction checks, event sync| Registry
  API -->|upload/fetch via adapter| Metadata
  Shared -. used by .-> API
  Shared -. used by .-> Issuer
  Shared -. used by .-> Verifier
  Shared -. platform-safe types and protocol code .-> Mobile
```

### Issuance sequence

```mermaid
sequenceDiagram
  actor Issuer
  participant Web as Issuer web app
  participant API as API and SQLite
  participant Store as IPFS or local storage
  participant Wallet as Issuer wallet
  participant Chain as CredentialRegistry

  Issuer->>Web: Connect wallet and sign login challenge
  Web->>API: Verify signature and create session
  Web->>API: Create issuance draft
  API->>Chain: Check issuer role
  Web->>API: Upload credential metadata
  API->>Store: Store manifest
  Store-->>API: Return metadata URI and CID
  API->>API: Compute canonical v1 Keccak hash
  API-->>Web: Return hash and metadata URI
  Web->>Wallet: Request issueCredential transaction
  Wallet->>Chain: Submit hash, learner, and metadata URI
  Web->>API: Confirm transaction hash
  API->>Chain: Check receipt, transaction input, and stored record
  API->>API: Mark operation confirmed and audit it
```

### Verification sequence and source of truth

1. A verifier submits a 32-byte credential hash or public verification URL.
2. The API reads the registry record. The browser can fall back to direct RPC when the API is unavailable.
3. The verifier fetches metadata using the record's URI. Direct browser verification uses the configured IPFS gateway.
4. The verifier normalizes the manifest, recomputes Keccak-256, and compares the hash and bound addresses.
5. The UI reports valid, not found, malformed, ledger unavailable, metadata unavailable, or metadata mismatch. An API outage does not make a proof invalid.

**Authority:** The registry anchors credential existence, issuer, learner, metadata URI, issue time, and issuer authorization. IPFS supplies the bytes for the URI. The API database projects chain events and stores operational records; it cannot replace the chain proof.

**Important boundaries:** The web issuer signs the issuance transaction in the user's wallet; private keys do not enter the API. `ORG_ADMIN` is an API-reviewed access role, separate from the on-chain issuer role. Temporary share codes resolve a fixed list of public hashes and do not prove that the presenter controls a learner wallet. v2 Merkle selective disclosure exists in `credential-core`; the registry interface and production user flows currently issue and verify v1 records.

**Evidence:** `apps/web/src/components/issuer-workspace.tsx`, `apps/api/src/index.ts`, `packages/blockchain/src/index.ts`, `packages/storage/src/index.ts`, `contracts/src/CredentialRegistry.sol`, `apps/web/src/lib/direct-verification.ts`, `apps/web/src/lib/verification-api.ts`.

## Slide 6 — Demonstration

### Suggested live walkthrough

1. **Show the product surface.** Open `/` and explain the proof path. The visualizer is explicitly illustrative, not a live chain read. `/demo` contains synthetic catalog examples, not issued credentials.
2. **Issue a real local credential.** Start Anvil, deploy `CredentialRegistry`, authorize a test issuer, and configure the API and web app for that registry. Connect the issuer wallet at `/issuer`, enter a learner address and credential fields, upload metadata, then approve the wallet transaction.
3. **Verify independently.** Open the resulting `/verify/<credential-hash>` link. Show the registry-bound result and public metadata. If configured, use direct RPC plus the IPFS gateway to demonstrate verification outside the API.
4. **Show holder sharing.** Open `/wallet`, copy a public credential link or create a selected, expiring share QR. Scan it with the mobile app or show the `/share/<token>` receiver. Explain that every hash is verified separately and that a QR does not authenticate its presenter.
5. **Show a failure state.** Demonstrate malformed input, an absent hash, or a deliberately unavailable registry/gateway. The verifier keeps service failures separate from proof mismatch.

### Setup and evidence notes

- A real issuance demo needs Anvil, a deployed registry, a funded local test wallet, and working metadata storage. Local file storage supports an API-backed demo; configure IPFS upload and gateway settings to demonstrate direct verification outside the API.
- Do not present `/demo` or the static proof visualizer as a live blockchain transaction.
- Native camera scanning, file sharing, accessibility, and safe-area behavior need Android/iOS device or emulator checks before claiming mobile release readiness.
- The organization applicant QR and superadmin approval flow is implemented in source, but should be presented as a workflow preview until the authenticated application, review, suspension, and registry-backed issuance paths receive end-to-end validation.

**Evidence:** `docs/setup/blockchain.md`, `apps/web/src/app/demo/page.tsx`, `apps/web/src/components/proof-storage-visualizer.tsx`, `apps/web/src/components/issuer-workspace.tsx`, `apps/mobile/App.tsx`, `tests/e2e/`.
