# ADR 0005: Public proofs with privacy-preserving metadata

## Status

Accepted.

## Decision

Credential existence and proof validity are publicly verifiable by anyone who
has the credential reference. Verification requires no learner consent and no
Credora account. This is the core advantage over a centralized verifier: a
school, employer, or learner can check the proof directly against the chain and
content-addressed storage, including with a self-hosted verifier.

The public IPFS manifest is deliberately minimal. It contains the normalized
hash inputs needed for verification (skill, level, issue date, issuer key,
learner wallet, and metadata version) plus optional human-readable description.
It must not contain transcripts, government identifiers, contact details, or
other unnecessary personal data.

Large or sensitive evidence is handled separately:

- The credential proof stores a CID for the public manifest, not a mutable HTTP
  URL.
- Optional evidence is encrypted client-side and shared out-of-band or through
  a future holder-mediated disclosure protocol.
- Selective disclosure is now supported as protocol version 2: the public
  manifest publishes a salted Merkle `claimsRoot`, the on-chain hash binds that
  root, and a holder presents only selected claim values plus Merkle proofs.
  Claim salts and unrevealed values remain with the holder. This must not weaken
  the public proof path or place decryption keys in the API.

The reusable implementation lives in `@credora/credential-core`:
`claimsRoot`, `hashSelectiveCredential`, `createSelectiveDisclosure`, and
`verifySelectiveDisclosureForCredential`. A verifier must check both the
Merkle proofs and the v2 hash binding; accepting a disclosure with only a
matching root is insufficient.

Learner ownership is non-custodial and wallet-based in v1. A learner may share
the reference/QR link freely. Wallet recovery or rotation is a future,
append-only relationship (for example, a signed key-link or DID document), not
an edit to an issued credential.

## Consequences

- Verification remains censorship-resistant and portable across frontends.
- Public metadata is intentionally limited; issuers must obtain consent before
  publishing optional descriptive text that could identify a learner.
- IPFS pinning and gateway availability are operational concerns, not sources
  of truth. A verifier must distinguish an unavailable gateway from an invalid
  proof.
- A leaked credential reference proves issuance but does not reveal private
  evidence that was never placed in the public manifest.
