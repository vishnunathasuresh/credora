# Architecture overview

```text
                 ┌── organization + issuer-key registry (chain)
Next.js web ─────┤
Expo Android ────┼── shared protocol packages ──┬── credential registry (chain)
Direct verifier ─┘                              └── IPFS metadata manifest
       │
       └── optional API projection (sessions, search, audit, UX)
```

Credora is a decentralized proof system with a convenience API, not a hosted
credential database. The chain is authoritative for organization authorization,
credential existence, issuer, learner, metadata URI, and issuance time. IPFS
is authoritative for the bytes addressed by the metadata CID; the recomputed
versioned Keccak-256 hash binds those bytes to the chain record.

The API is an operational projection. It may be unavailable, stale, rebuilt,
or replaced without changing verification truth. A direct verifier can read
the registry and IPFS without authenticating to Credora. Verification treats
ledger availability and metadata availability as separate failure states.

Production organizations should use a multisig or equivalent admin policy for
issuer-key authorization. Learner keys remain non-custodial; wallet recovery or
rotation is reserved for a future append-only protocol extension.

Credential protocol version 2 additionally supports selective disclosure:
holders can present selected claim values with Merkle proofs while keeping
unrevealed values and salts local. Version 1 credentials continue to use the
existing full public manifest path.

## Domain model

```text
Organization 1 ── authorizes ── * IssuerKey
IssuerKey     1 ── issues ───── * Credential ── references ── 1 MetadataManifest (IPFS)
LearnerWallet 1 ── owns/binds ─ * Credential
Credential    1 ── projects to ─ 0..* API rows
```

See the ADRs and [glossary](../glossary.md) for invariants, privacy rules, and
the v1-to-organization-registry migration boundary.
