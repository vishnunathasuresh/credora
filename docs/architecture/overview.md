# Architecture overview

Web application workflow with technology labels: [transparent PNG](credora-web-workflow.png) ·
[vector SVG](credora-web-workflow.svg) · [explanation](credora-web-workflow.md).

Connected end-to-end workflow: [transparent PNG](credora-system.png) ·
[vector SVG](credora-system.svg) · [Eraser Flow Chart code](credora-system.eraser).

Technology stack: [transparent PNG](credora-stack.png) ·
[vector SVG](credora-stack.svg) · [Eraser Architecture Diagram code](credora-stack.eraser).

Paste each source into its corresponding Eraser code editor. The transparent
previews are rendered locally with vector technology and workflow icons; Eraser's
automatic layout may differ. Filled cards remain opaque for legibility.

For diagram generation, use the [Eraser system architecture specification](eraser-system-architecture.md),
which maps these boundaries to components, connections, and runtime flows.

```text
                 ┌── reviewed organization records (API)
Next.js web ─────┼── shared protocol packages ──┬── credential registry (chain)
Direct verifier ─┘                              └── IPFS metadata manifest
       │
       └── optional API projection (sessions, search, audit, UX)
```

Credora is a decentralized proof system with a convenience API, not a hosted
credential database. The v1 chain is authoritative for v1 issuer authorization,
credential existence, issuer, learner, metadata URI, and issuance time. For
organization credentials, the separate v3 organization registry is
authoritative for activation, admin and issuer authorization, suspension, and
credential records. API organization and issuance rows are projections and
operational workflow state. IPFS is authoritative for the bytes addressed by
the metadata CID; an optional credential image is a separate public
content-addressed asset referenced by that manifest. The manifest URI binds
the image reference to the chain record.

The API holds chain-derived projections and operational organization records.
Chain-derived projections can be rebuilt; organization applications and
access decisions require a persistent, backed-up API database. The API may be
unavailable without changing verification truth. A direct verifier can read
the registry and IPFS without authenticating to Credora. Verification treats
ledger availability and metadata availability as separate failure states.

Wallet sharing is a short-lived API capability that groups up to 25 explicitly
selected public credential hashes behind one QR. The API stores only SHA-256
token digests and selection hashes; the separate management secret can revoke
the share but cannot change its contents. Expiry or revocation stops future
bundle lookup. Individual public proof records and copies already made by a
verifier remain public. Opening a share does not prove that the presenter
controls any learner wallet; each credential must still be verified through
the normal chain and IPFS path.

Legacy v1 issuance still requires a globally authorized issuer wallet. Under
ADR 0010, one superadmin activation transaction registers the approved
organization and its first owner/issuer. Organization admins then manage
issuer wallets without per-credential Credora approval. Production
organizations should use a multisig or equivalent governance policy for
on-chain administration. Learner keys remain non-custodial; wallet recovery or
rotation is reserved for a future append-only protocol extension.

The API proxies credential image bytes by CID for display. Issuer upload tokens
remain server-side; uploads accept PNG, JPEG, or WebP up to 5 MB. Local file
storage is for development, while production asset persistence follows the
configured IPFS storage adapter.

Credential protocol version 2 additionally supports selective disclosure:
holders can present selected claim values with Merkle proofs while keeping
unrevealed values and salts local. Version 1 credentials continue to use the
existing full public manifest path. Organization binding is assigned to
credential protocol version 3; v1 and v2 payloads remain unchanged.

## Domain model

```text
Organization (activated v3 registry record) ── groups ── * Issuance projection
OrganizationIssuer (registry-authorized) ── issues ── * Credential ── references ── 1 MetadataManifest (IPFS)
LearnerWallet ── owns/binds ─ * Credential
Credential ── projects to ─ 0..* API rows
```

See [ADR 0008](../decisions/0008-reviewed-organization-enrollment.md) for
organization intake and evidence review, [ADR 0010](../decisions/0010-organization-controlled-issuer-authority.md)
for organization authority, and [ADR 0009](../decisions/0009-expiring-selected-wallet-shares.md)
for wallet share capabilities. The [glossary](../glossary.md) and remaining
ADRs own proof invariants and privacy rules.

For implementation-grounded runtime, issuance, verification, projection,
organization/share, and deployment diagrams, see
[software architecture diagrams](diagrams.md).
