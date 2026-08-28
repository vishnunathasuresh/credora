# Credora review guidance

Prioritize correctness, security, and preservation of the protocol boundaries:

- Treat blockchain proofs as authoritative; API and SQLite data are projections.
- Never introduce private-key storage or unnecessary PII in the API or contracts.
- Use Keccak-256 for credential hashes and keep credential hashes distinct from IPFS CIDs.
- Treat issued credentials as immutable in v1; corrections require a future append-only revocation/status design.
- Keep dependencies flowing from packages to apps, never from packages to apps.
- Preserve platform-specific web/native UI boundaries while sharing domain types, hashing, validation, API contracts, and design tokens.
- Require distinct user-facing states for ledger, metadata, and other infrastructure failures.

For every pull request, look for missing tests around authorization, hash integrity,
immutability, replay protection, reorg/reconciliation behavior, and infrastructure
outages. Treat Copilot findings as advisory; CI and human review remain required.
