# Credora Engineering Rules

- Keep blockchain proofs authoritative; API/database state is a projection.
- Never store private keys or unnecessary PII in the API or contracts.
- Use Keccak-256 for credential hashes and keep it distinct from IPFS CIDs.
- Issued credentials are immutable in v1. Corrections require a future
  append-only revocation/status design.
- Apps may depend on packages; packages must not depend on apps.
- Keep web and native UI platform-specific where needed, while sharing domain
  types, hashing, validation, API contracts, and design tokens.
- Every infrastructure failure must have a distinct user-facing state.
- Prefer local, self-hostable, and free development dependencies.
