---
name: credora-architecture
description: Plan and review Credora changes across web, mobile, API, packages, storage, and Solidity while preserving authoritative proof and dependency boundaries.
---

# Credora Architecture

Use this skill when a change crosses a package boundary, changes data flow,
touches the registry or storage adapter, adds a user-facing state, or needs a
decision about web/native sharing.

## Boundary-first workflow

1. Identify the source of truth and the projection(s) affected. For credential
   verification, start with chain plus IPFS; treat API/database rows as
   rebuildable convenience state.
2. Locate the narrowest owning module using
   [change-impact.md](references/change-impact.md). Keep protocol logic in
   `packages/credential-core`, chain access in blockchain/contracts modules,
   and surface-specific behavior in the owning app.
3. Check dependency direction before adding an import: apps can depend on
   packages, never the reverse; packages must stay free of app-only UI or
   routing assumptions.
4. Model infrastructure failures independently. RPC, API, metadata gateway,
   malformed metadata, and proof mismatch must not collapse into one generic
   error or a false invalid result.
5. If the change alters a protocol invariant, privacy rule, source-of-truth
   boundary, or versioned payload, stop and create/update an ADR before
   implementation. Use `credora-docs` for the durable record.

## Review questions

- Can a third party verify the proof without trusting the API?
- Does the design preserve immutable v1 records and distinguish v1/v2?
- Does it avoid putting private keys or unnecessary PII in API, contract, or
  public metadata paths?
- Are web and native flows sharing only domain types, hashing, validation,
  API contracts, and tokens that are genuinely platform-safe?
- Does the UI expose stale, unavailable, pending, and invalid states honestly?
- Can projections be rebuilt from chain events without manually repairing
  chain-derived values?

Read [change-impact.md](references/change-impact.md) for the usual ownership
and impact map. Read the context skill's protocol reference for exact payload
and verification invariants.
