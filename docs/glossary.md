# Credora glossary

| Term                 | Meaning                                                                                                                             | Trust source                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Organization         | A school, university, or training provider represented by an on-chain identity.                                                     | Organization registry contract and its public manifest |
| Issuer key           | A wallet authorized by an organization to issue future credentials.                                                                 | On-chain authorization event/state                     |
| Learner wallet       | The non-custodial address bound to a credential as its learner/holder.                                                              | Credential record on the registry                      |
| Credential           | An immutable proof binding an issuer, learner, skill, issue time, and metadata reference.                                           | Registry record plus recomputed hash                   |
| Credential reference | The 32-byte Keccak-256 hash used to look up a credential.                                                                           | Hash algorithm and registry                            |
| Metadata manifest    | The normalized JSON document stored through IPFS and referenced by the credential.                                                  | CID-addressed content plus hash comparison             |
| CID                  | Content identifier returned by IPFS; identifies metadata bytes and is distinct from the credential hash.                            | IPFS/content addressing                                |
| Projection           | API/database state derived from chain events for UX, search, and operations.                                                        | Rebuildable from chain; never authoritative            |
| Confirmation depth   | Number of subsequent blocks required before an event is treated as finalized for projections.                                       | Configured synchronizer policy                         |
| Reorg                | A chain history change that can invalidate an unfinalized projection event.                                                         | Chain block hashes                                     |
| Public verification  | Proof checking that needs only a credential reference, registry RPC, and metadata retrieval; no Credora account or learner consent. | Direct chain + IPFS reads                              |
| Selective disclosure | A v2 presentation proving selected salted claims with Merkle proofs without revealing the rest.                                     | Claims root bound to the on-chain v2 hash              |

## Invariants

- A credential is immutable in v1; corrections require an append-only future
  status/revocation design.
- Keccak-256 credential hashes and IPFS CIDs are never interchangeable.
- The API cannot grant issuer authority or override a registry lookup.
- Public manifests contain only data necessary for verification and display.
