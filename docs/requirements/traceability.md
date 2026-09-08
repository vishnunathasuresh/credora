# Initial traceability

| Requirement                | Implementation boundary                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| Wallet authentication      | `packages/auth`, app wallet adapters                                         |
| Organization authorization | Next registry revision; v1 issuer role remains supported during migration    |
| Authorized issuance        | `contracts/src/CredentialRegistry.sol` plus organization/issuer-key registry |
| Deterministic proof        | `packages/credential-core`                                                   |
| Selective disclosure       | `packages/credential-core` v2 Merkle commitments and presentations           |
| Metadata storage           | `packages/storage` (IPFS CID manifests; local adapters for development)      |
| Independent verification   | `packages/blockchain`, `/verify`, direct RPC/gateway mode                    |
| Skill Wallet               | `apps/web`, `apps/mobile`                                                    |
| Audit projection           | `apps/api`, contract events                                                  |
| Low-cost MVP               | Anvil, local storage, SQLite                                                 |

## Decentralization advantages

- A verifier can bypass Credora's API and independently check chain + IPFS.
- Organizations can prove authorization publicly and rotate issuer keys without
  rewriting old credentials.
- Public manifests are portable and content-addressed; a gateway outage is
  distinguishable from an invalid credential.
- API search, dashboards, and sessions are replaceable conveniences rather than
  a centralized source of truth.
