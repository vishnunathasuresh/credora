# Credora, explained simply

This guide is for learning the project and answering presentation questions.
It describes what the current code does. It does not treat planned features as
finished features. The full implementation diagrams are in
[`docs/architecture/diagrams.md`](../docs/architecture/diagrams.md).

## The project in one paragraph

Credora lets an approved issuer publish a digital credential and lets another
person check that its details still match a public blockchain record. The
blockchain stores a compact proof reference and a few addresses. The credential
details live in a metadata file, normally on IPFS in production. Credora's API
helps with logins, drafts, organization access, sharing, and convenient lists.
The API database helps run the product, but the credential proof comes from
the blockchain record and matching metadata.

## A simple picture to remember

Think of a credential as a public document with a tamper check:

- **The blockchain is a public noticeboard.** It records that an authorized
  issuer published a particular credential hash for a learner address, and
  points to the metadata location.
- **The metadata is the document.** It contains the credential fields needed
  to read and check the credential. Production is configured for IPFS. Local
  development can save the file on the API server instead.
- **The hash is a fingerprint.** The app calculates it from the credential's
  canonical fields and metadata URI. If a hash input changes after
  normalization, the calculated fingerprint should change too.
- **The API is the product's helper desk.** It manages app sessions and work
  queues, and can calculate a verification result. Its database copy does not
  establish whether the public proof matches.
- **The wallet is the signing pen.** The issuer's wallet signs the login
  challenge and sends the issuance transaction. The private key stays in the
  wallet.

The comparison is only an analogy. The blockchain is software, not a literal
noticeboard, and a matching proof confirms consistency, not that a real-world
claim is true.

## What problem Credora addresses

If a credential can only be checked by asking the organization that issued it,
an outside verifier must trust that organization's website and database. That
can make checks difficult when the site is unavailable or the verifier has no
account there.

Credora gives the verifier a public reference. The verifier can fetch the
blockchain record and metadata, recalculate the hash, and compare the result.
That allows a check without a Credora login. It does **not** prove that the
issuer told the truth, that the learner is a particular human, or that the
person presenting the link controls the learner's wallet.

## How an issuer creates a credential

Here is the current web issuance path in ordinary words:

1. **The issuer connects a wallet.** The web app asks the API for a one-time
   challenge. The issuer signs that message with the wallet. The API checks the
   signature, consumes the challenge, and stores an expiring session. No
   private key is sent to the API.
2. **The issuer starts a draft.** The API checks the issuer wallet against the
   registry's on-chain issuer role, then stores a draft in SQLite.
3. **The API writes the metadata.** It builds the v1 manifest from the draft
   and sends it to IPFS in a configured deployment. If IPFS upload and gateway
   settings are not both configured, it uses local file storage.
4. **The API calculates the credential hash.** For v1, the hash covers the
   protocol version, issuer address, learner address, skill name, skill level,
   issue date, and metadata URI. The URI is included, so changing the referenced
   metadata location changes the expected hash.
5. **The issuer approves a blockchain transaction.** The browser wallet sends
   `issueCredential(hash, learner, metadataUri)`. The contract checks that the
   sending wallet has the issuer role and that the hash has not already been
   issued. It stores the hash, issuer, learner, URI, and issue time.
6. **The API checks the result.** It checks the receipt, transaction input, and
   registry record against the draft. It marks its SQLite row confirmed only
   when those values agree.

An API draft is not yet an issued credential. The contract transaction creates
the registry record. Because metadata is uploaded before the transaction, an
upload can remain unused if the issuer rejects the transaction or the
transaction fails.

Source: [issuer workspace](../apps/web/src/components/issuer-workspace.tsx),
[API issuance routes](../apps/api/src/index.ts),
[registry contract](../contracts/src/CredentialRegistry.sol).

## How verification works

1. The verifier pastes a credential hash or supported verification link.
2. The normal API route reads the hash from the blockchain registry.
3. If the registry has no record, the result is **not found**.
4. If a record exists, the verifier fetches metadata using the URI in that
   record.
5. The verifier recalculates the canonical hash and checks the issuer and
   learner addresses against the registry values.
6. Matching values produce **verified**. A changed or inconsistent manifest
   produces **metadata invalid**.

Credora keeps different problems separate:

- **Malformed:** the submitted reference is not a valid 32-byte hash.
- **Not found:** the selected registry has no record for that hash.
- **Ledger unavailable:** the registry or RPC cannot be reached.
- **Metadata unavailable:** the registry record exists, but the metadata
  service cannot provide the file.
- **Metadata invalid:** the file was returned, but its hash or bound addresses
  do not match.
- **Valid:** the record and metadata agree.

The web verifier calls the API first. If the request errors or returns HTTP
503, web code can try direct RPC and a public IPFS gateway. That fallback needs
browser-visible RPC, registry, and gateway configuration, and it handles
`ipfs://` metadata. It cannot read files stored in the API's local directory.

Sources: [API verification route](../apps/api/src/index.ts),
[web API-first verification](../apps/web/src/lib/verification-api.ts),
[web direct verification](../apps/web/src/lib/direct-verification.ts),

## Why use a blockchain?

A normal database is controlled by the organization that runs it. That is
useful for an app, but an outside verifier would have to trust that database's
owner to report the record correctly.

The registry gives all readers the same public record. Its contract also
checks the issuer role every time someone submits an issuance. A verifier can
read that record through an RPC service without asking the Credora API whether
to believe it.

The blockchain does not make a credential automatically true. It proves that
an authorized wallet recorded a particular hash and fields at a time. The
issuer is still responsible for deciding whether the learner earned the
credential. A verifier still needs to trust the issuer's authority and
standards.

### Why not put the whole credential on-chain?

Blockchain records are public and costly to write. Credential details can
also contain personal information. Credora writes a hash and the fields needed
to locate and bind the proof, then keeps the v1 detail manifest off-chain.
However, the v1 manifest is public, and the learner address and metadata URI
are visible on-chain. This design is not private or confidential.

## Why use IPFS?

IPFS uses a content identifier, or **CID**, to identify file bytes. If those
bytes change, the content identifier changes. This makes IPFS a useful place to
publish metadata that a verifier can fetch independently.

IPFS and the blockchain do different jobs:

- The **credential hash** is recalculated from the credential fields and the
  URI. It is the proof value stored in the registry.
- The **CID** identifies the metadata file's bytes in IPFS. It is part of the
  metadata URI, but it is not the credential hash.

IPFS does not guarantee that a file will always be available. Someone must
keep it pinned, and a gateway must be reachable. Credora must report a gateway
failure as metadata unavailable, rather than claiming the credential is
invalid.

The repository also supports local file storage for development. Production
Compose requires IPFS settings. So say **“IPFS in the configured production
path, local files in development”**, rather than saying every environment
always stores metadata on IPFS.

## Why keep an API and database?

The API makes the product practical. It handles wallet login challenges,
sessions, organization applications and review, issuance drafts, metadata
uploads, audit events, selected-share links, and pages that list credentials
or issuances. It also scans registry events into a SQLite projection so
dashboards do not need to scan the chain for every view.

The API is one Node HTTP process in `apps/api/src/index.ts`, not a collection of
independently deployed microservices. SQLite stores both useful copies of
chain events and operational records such as applications, sessions, and
share management. Chain-derived rows can be rebuilt from registry events.
Applications and access decisions cannot be reconstructed from the chain.

The API is replaceable as a proof authority, but product functions such as
sessions, organization workflows, and share bundles still depend on it. If
the API goes down, the proof remains unchanged and the web verifier can use its
direct RPC path when configured.

## Organization access and issuer permission are different

There are two separate questions:

- **May this wallet use the organization's website workspace?** The API answers
  this with its `ORG_ADMIN` role and organization records. A normal applicant
  submits an application and a superadmin approves or rejects it.
- **May this wallet issue on the blockchain?** The registry answers this with
  `ISSUER_ROLE`. The contract checks it during every issue transaction.

Approval for the website does not grant blockchain issuer permission. An
organization must have an authorized issuer wallet as well. The code also has
an operator setting called `API_ORG_ADMIN_ADDRESSES` that can bootstrap
organization-admin access without application review. The project documents
this as a trusted operator override.

The registry admin can be an ordinary wallet or an external multisig wallet.
The contract does not require a multisig itself. Using one is a production
operations policy, not a built-in feature.

## How credential sharing works

A holder selects up to 25 public credential hashes and chooses a 1, 7, or 30
day duration. The API creates a random share token plus a separate management
token. SQLite stores SHA-256 digests of those tokens and the fixed list of
hashes. A receiver uses the share token to retrieve that list; each credential
then goes through ordinary verification. The management token can turn off
future lookups.

The share is a **bearer link**. The share API does not require a wallet session
or bind a share to a verified holder wallet. A QR code does not prove who is
holding it. Revoking a share blocks future bundle lookups, but cannot remove
public blockchain records or copies that a verifier already received.

## The main parts of the code

| Part | In plain words |
| --- | --- |
| [`apps/web`](../apps/web/src/app/page.tsx) | The Next.js website for issuance, organization and admin workspaces, the holder wallet, public verification, and share pages. |
| [`apps/api`](../apps/api/src/index.ts) | The HTTP API. It handles sessions, roles, drafts, metadata, verification, sharing, admin operations, and chain synchronization. |
| [`packages/credential-core`](../packages/credential-core/src/index.ts) | Shared normalization and v1 hash functions, plus v2 selective-disclosure helpers. |
| [`packages/blockchain`](../packages/blockchain/src/index.ts) | The API's viem adapter for talking to the EVM registry. |
| [`packages/contracts`](../packages/contracts/src/index.ts) | The TypeScript ABI used by app code to call or read the Solidity contract. |
| [`packages/storage`](../packages/storage/src/index.ts) | The API's local-file and IPFS metadata adapters. |
| [`packages/auth`](../packages/auth/src/index.ts) | Shared wallet challenge creation and signature verification. |
| [`packages/shared`](../packages/shared/src/index.ts) | Shared role names, verification outcomes, and reference parsing. |
| [`contracts/src`](../contracts/src/CredentialRegistry.sol) | The Solidity registry. It records immutable v1 proofs and manages issuer permissions. |
| [`deploy`](../deploy/docker-compose.yml) | Docker Compose, Caddy HTTPS routing, and API/database operations. |

The normal dependency direction is app to package. The package code should not
depend on a web app. The API's routes and service logic are currently
combined in one large source file, which is important to describe honestly if
someone asks whether the backend has separate services.

## What is genuinely novel about this project?

Be careful with the word **novel**. Credora did not invent blockchain,
content-addressed storage, Keccak, or Merkle proofs. A strong and honest
description is:

> Credora combines an issuer-authorized blockchain registry with
> content-addressed credential metadata and an optional application API, so a
> verifier can check that credential details match a public record without
> treating the API database as the source of truth.

The project's value is in the way these pieces work together:

1. The contract checks the issuer permission at the point credentials are
   written.
2. The hash binds the public metadata location and canonical credential fields
   to the on-chain record.
3. A verifier can use registry plus metadata rather than relying only on a
   Credora database row.
4. The product separates organization website access from blockchain issuer
   authority.
5. It reports ledger outages, metadata outages, missing records, and bad
   metadata as different outcomes.
6. It includes short-lived selected-share links while making clear that a link
   does not prove learner-wallet control.

The v2 selective-disclosure code is an extension point, but it is not yet a
complete user-facing product flow. Present it as **implemented library
primitives**, not as a shipped holder feature.

## What is implemented, and what is still missing?

Implemented in the current code:

- v1 issuer authorization and immutable registry records.
- Web wallet challenge login and a browser-signed issuance transaction.
- v1 manifest upload, hash calculation, and API confirmation checks.
- API and web verification against registry and metadata.
- Organization application review and issuer authorization as separate steps.
- SQLite projections, chain-event scanning, and reorg overlap handling.
- Selected-hash sharing with expiry and a separate revoke token.
- v2 hash and Merkle proof helper functions in `credential-core`.

Not implemented as complete product features:

- A user-facing v2 selective-disclosure issue, share, and verify flow.
- A generic credential search endpoint. The API has scoped list endpoints.
- Learner wallet recovery or key rotation.
- On-chain organization identities and issuer-key administration.
- Credential revocation or correction in the v1 contract.
- Proof that the person presenting a credential controls its learner wallet.
- A built-in multisig rule for registry administrators.

There is an independent direct verification path in the web code, but it runs
as a fallback inside the web verifier. It is not a separately packaged or
deployed verifier application. Also, chain events created outside Credora's
API issuance workflow can enter the projection without an organization ID.

## Likely presentation questions and short answers

### “Why use blockchain instead of a normal database?”

The registry gives verifiers a public record that is not controlled only by
the issuing website or Credora's database. The database remains useful for
product work, but it is not the proof source.

### “Does the blockchain prove the credential is true?”

It proves an authorized issuer wallet recorded a particular credential hash.
It does not prove the issuer's real-world claim is honest. The verifier still
judges whether it trusts that issuer.

### “Why use both a credential hash and an IPFS CID?”

They answer different questions. The CID locates metadata bytes. The credential
hash is recalculated from the canonical fields and metadata URI to check that
those details match the registry record.

### “Can the API change or fake a valid proof?”

The API can affect its own responses and convenience data, but a verifier can
read the registry and fetch metadata independently. A credible verification
result must come from recomputing the hash and checking its bindings.

### “Can the learner's credential be private?”

Not in v1. The learner address, hash, URI, and public manifest are visible to
the relevant public services. V1 avoids putting the full manifest on-chain,
but it does not make the manifest confidential.

### “Can a credential be revoked?”

The current v1 contract has no revocation or correction function. Issued
records are immutable. A future status or revocation feature would need an
append-only design.

### “Is a credential an NFT?”

No. The current contract does not implement an NFT standard or transferable
token. It stores a credential record under a bytes32 hash and emits an event.

### “Does the learner need to sign or have a wallet?”

The current issuance flow takes a learner wallet address as an input. The
issuer signs the transaction. The learner does not sign the issuance or prove
control of that address in this protocol. Verification can happen without a
wallet or Credora login.

### “Which blockchain does Credora use?”

The application talks to an EVM-compatible chain through viem. Development
uses a local Anvil chain by default. Production selects its RPC URL, chain ID,
and registry address through configuration.

### “What if an issuer loses authorization later?”

The admin can remove the wallet's issuer role. That blocks future issuance by
that wallet. The current contract does not erase credentials it issued before
the role change.

### “Does a share QR prove that I own the wallet?”

No. It is a bearer link for a fixed selection of public hashes. Each credential
still needs verification, and verification does not authenticate the person
holding the QR.

### “What happens if IPFS or the blockchain is down?”

The app reports the relevant service as unavailable. It should not mark the
credential invalid unless it actually fetches the sources and finds a mismatch.
The web app may use its direct path during an API outage.

### “What is the project’s novelty?”

The project combines issuer authorization, public hash verification,
content-addressed metadata, a rebuildable API projection, and product-level
organization and share workflows. We should present that integration as the
project's contribution, rather than claiming that the underlying cryptographic
tools are new.

### “Is selective disclosure available in the app?”

The shared library can build and verify v2 Merkle disclosures. The normal
issuance, API, and web flows still use v1 public manifests, so the
selective-disclosure experience is not shipped end to end.

## A one-minute explanation you can practice

> Credora helps an organization issue a digital credential that another person
> can check without trusting only the organization's website. The issuer
> connects a wallet, the API prepares a public metadata file and calculates a
> hash, and the issuer's wallet sends that hash to an issuer-authorized
> blockchain registry. A verifier reads the registry record, fetches the
> metadata, and recalculates the hash over the bound credential fields and
> metadata URI. If those values match, the verifier confirms that the fetched
> metadata agrees with the proof recorded on-chain. The API still helps with logins,
> organization administration, sharing, and lists, but its database is a
> convenience layer. The current product flow is v1 and public. Selective
> disclosure exists in shared code as a future-facing v2 capability, but is not
> yet wired into the normal app.

## Words to use carefully

| Avoid saying | Say this instead |
| --- | --- |
| “Blockchain proves the person earned it.” | “The chain proves an authorized wallet recorded this hash; the verifier must trust the issuer's standards.” |
| “The credential is private.” | “V1 proof references and metadata are public.” |
| “IPFS guarantees the file stays online.” | “The CID identifies the file; pinning and gateway availability still matter.” |
| “Every app verifies without the API.” | “The web app has a direct fallback when configured.” |
| “V2 selective disclosure is shipped.” | “The core package has v2 helpers; the user-facing flow is not integrated.” |
| “Organizations are registered on-chain.” | “Organization applications and access are API records in v1.” |
| “A QR proves the holder owns the credential.” | “A QR shares a public reference; it does not prove wallet control.” |

## Small glossary

| Term | Simple meaning |
| --- | --- |
| EVM | The execution system used by Ethereum-style smart-contract networks. |
| RPC | The network endpoint the app asks to read blockchain data or submit a transaction. |
| Smart contract | Code deployed on a blockchain that follows the same rules for every caller. |
| ABI | The function and data format that lets TypeScript code call the Solidity contract. |
| Keccak-256 | The hash function used here to calculate a fixed-size credential fingerprint. |
| CID | The content identifier used by IPFS to find specific file bytes. |
| Projection | A convenient database copy derived from authoritative chain events. |
| Nonce | A one-use random challenge that prevents replaying an old wallet login signature. |
| Merkle proof | A short set of hashes that can show a selected claim belongs to a committed set. |
| On-chain | Stored or executed on the blockchain. |
| Off-chain | Stored or processed outside the blockchain, such as in the API or metadata storage. |

## Source files checked

- [API routes and background chain synchronization](../apps/api/src/index.ts)
- [SQLite schema and migrations](../apps/api/src/migrations.ts)
- [Solidity registry](../contracts/src/CredentialRegistry.sol)
- [Canonical and selective credential functions](../packages/credential-core/src/index.ts)
- [Web direct and API verification](../apps/web/src/lib/direct-verification.ts), [API-first selection](../apps/web/src/lib/verification-api.ts)
- [IPFS and file adapters](../packages/storage/src/index.ts)
- [Production Compose services](../deploy/docker-compose.yml)
- [Implementation diagrams](../docs/architecture/diagrams.md)
