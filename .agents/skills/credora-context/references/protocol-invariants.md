# Credora protocol invariants

Read this reference before changing credential identity, verification, storage,
issuer authorization, privacy, or protocol-version behavior.

## Canonical proof path

1. The issuer and learner addresses, skill fields, issue date, metadata URI,
   and protocol version form the canonical hash input.
2. TypeScript and Solidity use the same versioned ABI encoding and Keccak-256
   fixtures.
3. The registry stores the immutable credential record and exposes lookup via
   `getCredential(bytes32)`.
4. The metadata URI normally points to `ipfs://...`; the CID identifies bytes
   in content-addressed storage and is not itself the credential hash.
5. A verifier reads the chain record, fetches the manifest, normalizes the
   manifest, recomputes the versioned hash, and compares all bound fields.

## Version rules

- v1 hash payload: `version`, `issuerAddress`, `learnerAddress`, `skillName`,
  `skillLevel`, `issueDateSeconds`, and `metadataUri`.
- v2 hash payload: `version`, `issuer`, `learner`, `issueDateSeconds`,
  `metadataUri`, and `claimsRoot`.
- v2 leaves are Keccak hashes of `(claimName, claimValue, salt)`; sorted
  Merkle nodes make proof direction unnecessary.
- A v2 credential must not be represented as a v1 hash or silently downgraded
  to a public full-claim manifest.

## Failure semantics

Verification must distinguish at least these states:

- malformed or invalid credential reference;
- ledger/RPC unavailable;
- credential absent from the selected registry;
- metadata unavailable or gateway failure;
- metadata malformed or inconsistent with the chain record;
- hash or bound-field mismatch;
- valid proof.

An API outage is a convenience failure, not proof invalidity. Direct RPC and
direct gateway verification should remain possible where configuration allows.

## Source documents

The maintained decisions live in `docs/decisions/0001` through `0007`, with
the architecture summary in `docs/architecture/overview.md` and terms in
`docs/glossary.md`. Update those documents when a protocol decision changes;
do not let this reference become a competing specification.
