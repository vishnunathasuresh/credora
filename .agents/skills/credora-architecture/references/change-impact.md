# Architecture change-impact map

Use this as a routing aid, not as a substitute for reading the owning code.

| Change | Primary owner | Verify alongside |
| --- | --- | --- |
| hash payload, normalization, Merkle claims | `packages/credential-core` | package fixtures, contract integration tests, ADR 0002/0007 |
| ABI, registry call, chain client | `packages/contracts`, `packages/blockchain`, `contracts/src` | Foundry tests and API/web call sites |
| manifest schema, CID/IPFS adapter | `packages/storage`, `apps/api` | storage tests, IPFS smoke, metadata failure states |
| session, roles, operational projection | `packages/auth`, `apps/api` | route/role/outage e2e tests |
| public verification behavior | `apps/web`, `apps/api`, direct verifier helpers | direct verification and browser/API fallback paths |
| web-only interaction or layout | `apps/web` | responsive, accessibility, reduced-motion, and visual QA |
| mobile interaction or navigation | `apps/mobile` | platform-specific build/typecheck and verification behavior |
| shared domain contract | `packages/shared` | all consumers and API route tests |
| protocol or privacy decision | `docs/decisions` plus owning code | architecture overview, glossary, traceability |

## Common dependency traps

- Do not import from `apps/*` inside `packages/*`.
- Do not put signing keys, session secrets, or IPFS upload tokens in browser
  bundles or public configuration.
- Do not make the API a required hop for public verification if direct chain
  and gateway sources are available.
- Do not use a CID as a credential hash, or trust a metadata field named
  `credentialHash` over a recomputation from canonical inputs.
- Do not share a web component with mobile merely because the visual output is
  similar; share its domain contract or token only when it is platform-safe.
