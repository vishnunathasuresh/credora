# Credora Engineering Rules

## Product direction

Before planning or changing identity, profiles, credentials, sharing,
organizations, or networking, read
[the agreed product direction](docs/roadmap/product-direction.md).
Use its delivery order and acceptance criteria; it describes planned behavior,
not implementation status. Preserve the protocol decisions below while building
toward that direction.

## Project skills

The repository keeps reusable Codex guidance in `.agents/skills/`. Use
`credora-context` for every Credora task, then pair it with the narrowest
specialist: `credora-architecture` for boundaries and change impact,
`credora-development` for implementation, `credora-testing` for validation,
and `credora-docs` for durable project documentation. These skills complement
this file; they do not replace the engineering rules below.

- Keep blockchain proofs authoritative; chain-derived API/database state is a
  rebuildable projection. User-authored profiles and publication settings are
  authoritative application data under ADR 0011 and require durable backups.
- Never store private keys or unnecessary PII in the API or contracts.
- Use Keccak-256 for credential hashes and keep it distinct from IPFS CIDs.
- Issued credentials are immutable in v1. Corrections require a future
  append-only revocation/status design.
- Apps may depend on packages; packages must not depend on apps.
- Keep the web UI in `apps/web`; share domain types, hashing, validation, API
  contracts, and design tokens through workspace packages.
- Every infrastructure failure must have a distinct user-facing state.
- Prefer local, self-hostable, and free development dependencies.

## Git Workflow

- Commit work frequently in small, relevant, self-contained commits as implementation progresses.
- Push completed commits to the configured upstream branch throughout the task; do not wait until the entire task is finished.
- Do not include unrelated user changes in a commit. Review the staged diff before committing and use the repository's existing branch unless the user requests otherwise.
