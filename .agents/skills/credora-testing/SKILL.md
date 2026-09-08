---
name: credora-testing
description: Choose, write, and run Credora tests for protocol integrity, contracts, adapters, API projections, outages, roles, and user-facing verification states.
---

# Credora Testing

Use this skill whenever a Credora change needs validation, especially around
hashing, transaction receipts, metadata integrity, RPC/API/IPFS outages,
authorization, projections, or verification UI states.

## Test from the source of truth outward

1. Start with deterministic unit tests for normalization, canonical hashes,
   Merkle proofs, schema validation, or adapter outcomes.
2. Add Foundry tests when Solidity behavior, authorization, immutability, or
   registry events change.
3. Add API integration/e2e coverage when the change crosses an HTTP route,
   signed transaction, projection, role, Anvil, or external adapter boundary.
4. Add web/mobile tests or a bounded visual/manual QA pass when interaction,
   responsive layout, accessibility, reduced motion, or user-facing states
   change.

Do not stop at a happy-path test for infrastructure code. A valid proof,
missing record, unavailable ledger, unavailable metadata, malformed metadata,
and hash mismatch should remain observably distinct.

## Required assertions for proof work

- The same canonical fixture hashes identically across TypeScript and Solidity.
- A changed bound field, URI, version, or claims root fails verification.
- A v2 disclosure verifies only when Merkle proofs and the v2 hash binding both
  pass; a matching root alone is insufficient.
- API/projection disagreement does not overwrite chain truth.
- Reverted or unconfirmed transactions are not reported as issued.

Read [test-matrix.md](references/test-matrix.md) for commands, test locations,
and scenario coverage. Use `credora-context` for the protocol invariants that
the assertions must protect.
