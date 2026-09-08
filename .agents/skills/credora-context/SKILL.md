---
name: credora-context
description: Ground any Credora task in the repository's protocol truth, privacy boundary, terminology, and source-of-truth rules before planning or editing.
---

# Credora Context

Use this skill for any task in the Credora checkout, especially when a request
mentions credentials, verification, storage, issuer authorization, wallets,
organizations, projections, or the homepage proof visualization.

## Non-negotiable context

- The blockchain registry is authoritative for credential existence, issuer,
  learner, metadata URI, issuance time, and authorization. The API/database is
  a rebuildable projection for sessions, search, audit, and UX.
- Credential hashes use versioned Keccak-256 over the canonical payload. Never
  confuse a credential hash with an IPFS CID; the hash binds the proof while
  the CID addresses metadata bytes.
- Issued credentials are immutable in v1. Corrections, revocation, key
  rotation, or recovery must be append-only protocol work, never an edit or
  delete of an issued record.
- Keep private keys and unnecessary learner PII out of APIs, contracts, and
  public manifests. Selective disclosure is commitment-based, not a
  zero-knowledge proof and not proof of wallet control.
- Never label synthetic catalog data as live verification data. Use
  `Illustrative credential flow` for canonical static/demo content until a
  real transaction and metadata path is connected.

## How to use it

1. Read [protocol-invariants.md](references/protocol-invariants.md) when the
   task touches hashing, contracts, metadata, verification, privacy, or v2
   selective disclosure.
2. Read [repository-map.md](references/repository-map.md) when the task spans
   apps, packages, contracts, or docs.
3. Pair this skill with the narrowest specialist: architecture for boundaries,
   development for implementation, testing for verification, and docs for
   durable written decisions.

When repository code conflicts with an ADR, stop and identify the discrepancy;
do not silently encode the implementation as the new protocol truth.
