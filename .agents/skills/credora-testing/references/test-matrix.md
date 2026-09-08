# Credora test matrix

| Concern | Where to add coverage | Command |
| --- | --- | --- |
| credential normalization, v1/v2 hashes, selective disclosure | `packages/credential-core/src/index.test.ts` | `pnpm --filter @credora/credential-core test` |
| metadata schemas and integrity outcomes | `packages/storage/src/index.test.ts` | `pnpm --filter @credora/storage test` |
| demo fixture guarantees | `packages/demo-data/src/index.test.ts` | `pnpm --filter @credora/demo-data test` |
| registry authorization, events, immutability | `contracts/test/*.t.sol` | `pnpm contracts:test` |
| API health and basic issuance/verification | `tests/e2e/backend-smoke.mjs` | `pnpm test:e2e:backend` |
| routes and validation | `tests/e2e/backend-routes.mjs` | `pnpm test:e2e:backend:routes` |
| server-side roles and authorization | `tests/e2e/backend-roles.mjs` | `pnpm test:e2e:backend:roles` |
| API outage and direct-verification fallback | `tests/e2e/backend-outage.mjs` | `pnpm test:e2e:backend:outage` |
| hosted IPFS behavior | `tests/e2e/ipfs-smoke.mjs` | `pnpm test:e2e:ipfs` |

## Layered validation

For a local change, prefer this order:

```sh
pnpm --filter <owner> typecheck
pnpm --filter <owner> test
pnpm typecheck
pnpm test
pnpm lint
```

Add `pnpm contracts:test`, build, and the relevant e2e commands when the
change touches the chain or a running service. If a test requires Anvil,
document the startup/configuration assumption instead of making the test
silently skip.

## Failure injection checklist

When a dependency can fail, cover at least one test for each meaningful
boundary: connection refused/timeout, malformed response, missing record,
reverted transaction, stale projection, and valid recovery/retry. Assertions
should check both machine-readable status and user-facing semantics where
those are part of the contract.
