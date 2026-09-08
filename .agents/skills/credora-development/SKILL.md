---
name: credora-development
description: Implement Credora features and fixes with repository conventions for TypeScript, Solidity, storage adapters, verification, UI states, and safe configuration.
---

# Credora Development

Use this skill for implementation work after the owning boundary is clear. Pair
it with `credora-context` for every Credora change and `credora-architecture`
when more than one app/package is involved.

## Implementation loop

1. Read the relevant ADR and inspect the existing caller, type, and test before
   editing. Prefer the smallest self-contained change at the owning boundary.
2. Keep canonical domain logic in packages. Reuse the existing credential-core
   hash/normalization helpers instead of reimplementing Keccak or ABI encoding
   in an app or route.
3. Treat external operations as explicit state machines: parse/validate,
   pending, success, unavailable, malformed, mismatch, and retry where
   appropriate. Never turn an RPC, API, or gateway outage into `invalid`.
4. Keep private keys, upload tokens, and unnecessary PII server-side or out of
   the system entirely. Browser wallets sign client-side; the API verifies
   resulting transactions rather than receiving private keys.
5. Preserve v1 immutability and version boundaries. A correction feature is
   not an update endpoint; it needs an append-only protocol design.
6. Add or update tests with the code. For protocol or adapter work, use the
   dedicated testing skill and run the narrowest relevant checks before the
   workspace suite.
7. Format only the files in scope, inspect the diff, then run typecheck/build
   and the relevant tests. Do not hide unrelated user changes.

Read [code-patterns.md](references/code-patterns.md) for local commands,
configuration boundaries, and implementation patterns.
