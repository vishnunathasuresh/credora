# ADR 0001: Protocol boundaries

## Decision

The blockchain is authoritative for credential existence, issuer, learner,
metadata URI, and issuance timestamp. The API stores operational projections,
sessions, and audit views but cannot change verification truth.

Metadata is stored behind `MetadataStorage`, with IPFS as the intended public
deployment and local/mock adapters for development. IPFS CIDs and credential
Keccak hashes are separate identifiers.

## Consequences

- Verification can work without an authenticated wallet.
- The API can be rebuilt from chain events.
- Local development does not require paid infrastructure.
- Public metadata must not contain unnecessary sensitive information.
