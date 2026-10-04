# ADR 0009: Expiring selected-credential wallet shares

Status: accepted

## Context

Holders need one QR that can carry a selected set of public credentials without
creating a stable public profile URL. The chain and IPFS remain authoritative
for each proof, while the API can resolve a temporary bundle for a verifier.
The share must not silently include credentials added later or imply that the
person showing the QR controls a learner wallet.

## Decision

- Create a random, high-entropy share token and return it once. Store only its
  SHA-256 digest. Store the fixed ordered list of 1–25 credential hashes and an
  expiry of 1, 7, or 30 days.
- Give the holder a separate random management capability whose digest is
  stored. It can revoke a share only; it cannot edit selection, expiry, or
  issue another share.
- Replacing a selection creates a new share. Revoking or expiring a share
  prevents future bundle resolution. Existing screenshots, copies, and public
  verification references cannot be recalled.
- The share response contains hashes and expiry, not authoritative credential
  data. A verifier resolves each hash through the ordinary verification flow,
  which checks chain and IPFS independently and keeps outage states distinct
  from invalid proofs.
- The QR is a bearer capability for public credential references, not an
  authentication factor or proof of wallet control. It is not a permanent
  wallet identifier. Use no-store, no-referrer, and noindex headers on share
  pages and avoid logging raw tokens.
- Organization logos are reviewed profile decoration and are not included in
  the credential hash or proof claim. Their absence or change cannot alter
  verification.

## Consequences

The API must be available to discover a bundle, although individual credentials
remain independently verifiable. A leaked active QR exposes its selected public
records until expiry or revocation. The client must explain this and make the
selected set and expiry visible before sharing. This flow does not add selective
disclosure or hide public fields inside an issued credential.
