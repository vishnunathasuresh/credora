# Credora glossary

| Term                 | Meaning                                                                                                                                                  | Trust source                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Organization         | A school, university, or training provider. Current organizations are reviewed API records; the target v3 model adds an on-chain identity at activation. | API record today; registry under ADR 0010            |
| Organization ID      | An opaque stable identifier for an activated organization, bound into credential hash version 3.                                                         | Organization-aware registry                          |
| Issuer key           | A wallet authorized by the credential registry to issue credentials. In the target model, an organization admin manages its issuer keys.                 | On-chain authorization event/state                   |
| Learner wallet       | The non-custodial address bound to a credential as its learner/holder.                                                                                   | Credential record on the registry                    |
| Credential           | An immutable proof binding an issuer, learner, skill, issue time, and metadata reference.                                                                | Registry record plus recomputed hash                 |
| Credential reference | The 32-byte Keccak-256 hash used to look up a credential.                                                                                                | Hash algorithm and registry                          |
| Metadata manifest    | The normalized JSON document stored through IPFS and referenced by the credential.                                                                       | CID-addressed content plus hash comparison           |
| CID                  | Content identifier returned by IPFS; identifies metadata bytes and is distinct from the credential hash.                                                 | IPFS/content addressing                              |
| Projection           | API/database state derived from chain events for UX, search, and operations.                                                                             | Rebuildable from chain; never authoritative          |
| Organization admin   | An organization operator. Current access is an API role; under ADR 0010, activation also establishes an initial on-chain organization admin and issuer.  | API role today; organization registry under ADR 0010 |
| Confirmation depth   | Number of subsequent blocks required before an event is treated as finalized for projections.                                                            | Configured synchronizer policy                       |
| Reorg                | A chain history change that can invalidate an unfinalized projection event.                                                                              | Chain block hashes                                   |
| Public verification  | Proof checking that needs only a credential reference, registry RPC, and metadata retrieval; no Credora account or learner consent.                      | Direct chain + IPFS reads                            |
| Selective disclosure | A v2 presentation proving selected salted claims with Merkle proofs without revealing the rest.                                                          | Claims root bound to the on-chain v2 hash            |

## Invariants

- A credential is immutable in v1; corrections require an append-only future
  status/revocation design.
- Keccak-256 credential hashes and IPFS CIDs are never interchangeable.
- The API cannot grant issuer authority or override a registry lookup.
- Public manifests contain only data necessary for verification and display.
