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
