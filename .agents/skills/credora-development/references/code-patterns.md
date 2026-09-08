# Credora implementation patterns

## Workspace commands

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm contracts:test
```

Use package filters for a fast loop, for example
`pnpm --filter @credora/credential-core test` or
`pnpm --filter @credora/api typecheck`. Run `pnpm contracts:build` before
contract integration work when generated artifacts or imports may be stale.

## Configuration boundary

- Server-only: `PRIVATE_KEY` for local deployment, API role address lists,
  `IPFS_UPLOAD_AUTH_TOKEN`, and any session secrets.
- Public browser configuration: `NEXT_PUBLIC_*` RPC, chain ID, registry
  address, API URL, and read-only gateway values only.
- Local development may use `local://` metadata through the API, but an
  independently verifiable production path should use IPFS-backed metadata.

## Code shape

- Use shared types from `packages/shared` for API/domain contracts.
- Use `@credora/credential-core` for canonical normalization, hash creation,
  v2 claims roots, and selective disclosure verification.
- Make adapters return typed outcomes that preserve the difference between
  unavailable infrastructure and bad content.
- Keep API projections disposable: include source registry, credential hash,
  block number/hash, transaction hash, and log index where available.
- Keep user-facing error text specific enough to tell a gateway outage from a
  proof mismatch and actionable enough to retry the right dependency.

## UI and content

Use `Illustrative credential flow` for static/demo proof visuals. If a UI maps
the proof path, show credential preparation, proof generation, chain anchor,
and independent verification as distinct stages. On mobile use a vertical
timeline; expandable technical details should not be the only place where
status or failure is communicated. Honor reduced motion and accessible labels.
