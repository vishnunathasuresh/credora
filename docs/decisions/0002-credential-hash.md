# ADR 0002: Versioned Keccak-256 credential hash

Credential hashes use a versioned ABI-encoded payload:

```text
uint8 version
address issuerAddress
address learnerAddress
string skillName
string skillLevel
uint64 issueDateSeconds
string metadataUri
```

The encoded payload is hashed with Keccak-256. The same implementation and
fixtures are used across TypeScript clients and Solidity integration tests.

## Rationale

This keeps the hash deterministic across platforms and binds the immutable
proof to the issuer, learner, skill, date, and metadata reference.

The metadata object is stored without a required copy of `credentialHash`.
The storage adapter first returns the metadata URI, after which the canonical
payload is hashed. Verification recomputes the hash from the ledger record and
the retrieved metadata, avoiding a circular dependency between a content CID
and a hash that contains that CID. `credentialHash` remains optional in the
metadata schema for compatibility, but is never trusted as the source of
verification truth.
