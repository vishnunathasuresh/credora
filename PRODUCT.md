# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Organizations that issue credentials, people who hold them, and independent verifiers who need to check a credential without creating an account or connecting a wallet.

## Product Purpose

Credora makes skills and certifications portable and independently checkable. An issuer creates a credential, a holder carries it, and a verifier checks the public record.

## Positioning

Credora separates the authoritative blockchain proof from the metadata and rebuildable application projection, so verification can remain independently checkable instead of depending on one private database.

## Operating Context

The web app includes public verification, issuer and organization workspaces, a holder wallet, administrative surfaces, and an illustrative proof-path walkthrough. The homepage must distinguish static demo content from live verification.

## Capabilities and Constraints

- The blockchain registry is authoritative for credential existence, issuer, learner, metadata URI, issuance time, and authorization.
- Credential hashes use versioned Keccak-256 and are distinct from IPFS CIDs.
- Issued credentials are immutable in v1.
- A verifier should not need a wallet for read-only verification.
- Infrastructure failures must remain distinct from invalid proofs.
- Static demo content must be labeled as illustrative and never presented as live chain data.

## Brand Commitments

The product name is Credora. The existing copy favors direct, durable language around ownership, proof, portability, and independent verification.

## Evidence on Hand

The current repository contains the real verification flow, role routes, protocol documentation, and a static proof-path visualizer. It does not contain live customer stories or production credential data to use as marketing proof.

## Product Principles

- Keep proof authoritative.
- Make credentials portable.
- Preserve privacy boundaries.
- Explain system state honestly.
