# ADR 0004: Organization-scoped issuance

## Status

Accepted for the next protocol revision; the current v1 contract remains
compatible until the migration is implemented.

## Context

Credora's customers are schools, universities, and training providers. A raw
wallet address is not an adequate organizational identity: it makes it hard to
express who controls an issuer, rotate operational keys, or prove which
institution stands behind a credential. At the same time, putting an
organization's name and other personal data in the API would make the API an
unnecessary trust anchor.

## Decision

Introduce an on-chain organization identity and issuer-key model in the next
registry revision:

- An `Organization` is identified by a stable on-chain `organizationId` and a
  public metadata URI. Its metadata contains the institution's display name,
  website, and optional logo, but no private learner data.
- An organization admin authorizes one or more `IssuerKey` wallet addresses.
  Issuance transactions record both the organization and the issuing wallet.
- Organization administration is controlled by an on-chain role/multisig. The
  API may help prepare transactions, but cannot grant itself issuer authority.
- Existing v1 records remain valid. Their issuer address is interpreted as the
  issuing key and is not retroactively assigned to an organization without an
  explicit on-chain migration event.

The protocol should expose append-only events for organization creation,
organization metadata updates, issuer-key authorization, and credential
issuance. Key rotation changes future authorization only; it does not rewrite
past credentials.

## Consequences

- Verifiers can independently establish which organization authorized an
  issuer key by reading the chain.
- Institutions can rotate compromised wallets without invalidating old proofs.
- The API can cache organization and issuer projections, but a verifier does
  not need to trust that cache.
- A multisig or equivalent organization-admin policy is an operational
  requirement for production deployments.
- The hash payload must gain a versioned organization binding in the next
  protocol version; v1 hashes remain unchanged.

## Migration notes

Implement this as a new registry version or append-only companion registry.
Do not mutate the v1 `Credential` struct or reinterpret its hash. During
migration, verification must recognize both versions and display the source
registry/version explicitly.
