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

The TanStack Start web app includes QR-first public verification, issuer and organization workspaces, organization applications with superadmin review, a holder credential library with selected-credential share links and QR codes, public profiles, and administrative surfaces. Public profiles are opt-in and contain the owner's selected fields and credentials. The profile editor supports an HTTPS avatar URL, projects, experience, and education with stable entry IDs and user-controlled ordering; each of those lists is capped at eight entries. Selected credentials are presented as proof summaries, not as a new verification result. Issuers can optionally attach a public image to credential metadata; its QR continues to open the independently verifiable public record.

Google sign-in through Supabase Auth now provides account-owned profiles before wallet linking. Signed wallet associations support credential selection and explicit legacy-profile imports; issuer operations continue to use separate wallet sessions. Live OAuth requires provider configuration. Independent recovery overrides and automatic wallet reassignment are not shipped. Profile fields, handles, publication choice, and credential selection are authoritative application data requiring durable backup, as recorded in [ADR 0011](docs/decisions/0011-profile-identity-and-publication.md). Chain-derived credential projections remain rebuildable; the ledger and content-addressed metadata remain authoritative for issued proof.

## Capabilities and Constraints

- The blockchain registry is authoritative for credential existence, issuer, learner, metadata URI, issuance time, and issuer authorization. Organization administrator authority is enforced by the organization registry; organization review and issuer delegation remain distinct.
- Credential hashes use versioned Keccak-256 and are distinct from IPFS CIDs.
- Issued credentials are immutable in v1.
- A verifier should not need a wallet for read-only verification.
- Infrastructure failures must remain distinct from invalid proofs.
- The product UI contains no seeded credential or organization demo catalog.
- Public profiles start private. Publishing explicitly exposes the selected profile fields and credential references and may associate a person's name with public wallet records. Unpublishing cannot recall copied profile content or public issuance records.
- Profile content is user-authored and does not change credential metadata, hashes, issuance, or wallet ownership. A public profile or credential summary is not itself proof of identity or wallet control.
- The full credential view uses the actual React Bits lanyard implementation on demand, with HTML proof details and a static flip path for reduced motion or unavailable WebGL. The landing preview is illustrative and labeled; synthetic preview content is not live credential data.

## Roadmap Boundary

The current product supports profiles, opt-in publication, credential selection, and sharing. Follows, feeds, jobs, messaging, discovery, and recommendation systems remain future roadmap work, gated by moderation, reporting, blocking, privacy, and repeat-use evidence. Account authentication and wallet association follow ADRs 0012 and 0013; account recovery never transfers credential ownership. Follow the delivery sequence in [the agreed product direction](docs/roadmap/product-direction.md); do not describe planned capabilities as shipped.

## Brand Commitments

The product name is Credora. The existing copy favors direct, durable language around ownership, proof, portability, and independent verification.

## Evidence on Hand

The current repository contains the real verification flow, role routes, protocol documentation, and no seeded production credentials. It does not contain live customer stories or production credential data to use as marketing proof.

## Product Principles

- Keep proof authoritative.
- Make credentials portable.
- Preserve privacy boundaries.
- Explain system state honestly.
