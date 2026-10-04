# Architecture overview

```text
                 ┌── reviewed organization records (API)
Next.js web ─────┤
Expo Android ────┼── shared protocol packages ──┬── credential registry (chain)
Direct verifier ─┘                              └── IPFS metadata manifest
       │
       └── optional API projection (sessions, search, audit, UX)
```

Credora is a decentralized proof system with a convenience API, not a hosted
credential database. The v1 chain is authoritative for issuer authorization,
credential existence, issuer, learner, metadata URI, and issuance time. An
organization name and its applicant's `ORG_ADMIN` access are reviewed API
records in v1; they are not registered on-chain and do not establish legal
identity. IPFS
is authoritative for the bytes addressed by the metadata CID; the recomputed
versioned Keccak-256 hash binds those bytes to the chain record.

The API holds chain-derived projections and operational organization records.
Chain-derived projections can be rebuilt; organization applications and
access decisions require a persistent, backed-up API database. The API may be
unavailable without changing verification truth. A direct verifier can read
the registry and IPFS without authenticating to Credora. Verification treats
ledger availability and metadata availability as separate failure states.

Production organizations should use a multisig or equivalent admin policy for
issuer-key authorization. Organization applications require explicit
superadmin review. That review does not grant issuer status; the registry still
checks the signing issuer wallet for each issuance. Learner keys remain
non-custodial; wallet recovery or rotation is reserved for a future
append-only protocol extension.

Credential protocol version 2 additionally supports selective disclosure:
holders can present selected claim values with Merkle proofs while keeping
unrevealed values and salts local. Version 1 credentials continue to use the
existing full public manifest path.

## Domain model

```text
Organization (reviewed API record) ── groups ── * Issuance projection
IssuerWallet (registry-authorized) ── issues ───── * Credential ── references ── 1 MetadataManifest (IPFS)
LearnerWallet ── owns/binds ─ * Credential
Credential ── projects to ─ 0..* API rows
```

See [ADR 0008](../decisions/0008-reviewed-organization-enrollment.md) for the
manual enrollment and role boundary, and the other ADRs and [glossary](../glossary.md)
for proof invariants, privacy rules, and the future organization-registry
migration boundary.
