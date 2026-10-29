# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Organizations that issue credentials, people who hold them, and independent verifiers who need to check a credential without creating an account or connecting a wallet.

## Product Purpose

Credora builds a shareable professional identity around people and their achievements. Issuer-backed credentials provide independently checkable evidence. Usernames and opt-in public profiles are the foundation; networking follows the agreed roadmap.

## Positioning

Credora separates the authoritative blockchain proof from the metadata and rebuildable application projection, so verification can remain independently checkable instead of depending on one private database.

## Operating Context

The web app includes QR-first public verification, issuer and organization workspaces, organization applications with superadmin review, a holder wallet with selected-credential share QR codes, and administrative surfaces. Issuers can optionally attach a public image to credential metadata; the credential QR continues to open the verifiable public record. The TanStack Start web app uses existing wallet sessions for profile editing and credential workflows. Pre-wallet accounts and recovery remain future work. Profiles and publication preferences are authoritative application data, distinct from chain-derived projections.

## Capabilities and Constraints

- The blockchain registry is authoritative for credential existence, issuer, learner, metadata URI, issuance time, and issuer authorization. Organization administrator authority is enforced by the organization registry; organization review and issuer delegation remain distinct.
- Credential hashes use versioned Keccak-256 and are distinct from IPFS CIDs.
- Issued credentials are immutable in v1.
- A verifier should not need a wallet for read-only verification.
- Infrastructure failures must remain distinct from invalid proofs.
- The product UI contains no seeded credential or organization demo catalog.

## Brand Commitments

The product name is Credora. The existing copy favors direct, durable language around ownership, proof, portability, and independent verification.

## Evidence on Hand

The current repository contains the real verification flow, role routes, protocol documentation, and no seeded production credentials. It does not contain live customer stories or production credential data to use as marketing proof.

## Product Principles

- Keep proof authoritative.
- Make credentials portable.
- Preserve privacy boundaries.
- Explain system state honestly.
