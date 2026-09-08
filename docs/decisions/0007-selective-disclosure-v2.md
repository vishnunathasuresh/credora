# ADR 0007: Selective disclosure credential presentations

## Status

Accepted and implemented in `@credora/credential-core`.

## Decision

Credora supports a version 2 credential format whose hash commits to a salted
Merkle root of claims:

```text
keccak256(abi.encode(
  uint8 version = 2,
  address issuer,
  address learner,
  uint64 issueDateSeconds,
  string metadataUri,
  bytes32 claimsRoot
))
```

Each leaf is:

```text
keccak256(abi.encode(string claimName, string claimValue, bytes32 salt))
```

Leaves and parent nodes are sorted before hashing, so a proof does not need to
reveal left/right positions. A holder creates a presentation containing the
credential reference, the root, and proofs for only the selected claims. The
verifier recomputes the leaf and Merkle path, then recomputes the v2 credential
hash from the disclosed root and the chain-bound payload.

The public IPFS manifest may contain the root and explicitly public claims, but
must not contain unrevealed claim values or salts. A holder may keep the
complete claim set in a wallet export or encrypted local storage.

## Security boundary

This is selective disclosure of committed claims, not a zero-knowledge proof.
The verifier learns the selected values, while hidden values are not needed for
verification. The protocol does not by itself prove that the presenter
controls the learner wallet; a future holder-signature layer can add that
property without changing the Merkle commitment.

Version 1 credentials and hashes remain fully supported and unchanged. A v2
credential must never be represented as a v1 hash or silently downgraded to a
public full-claim manifest.
