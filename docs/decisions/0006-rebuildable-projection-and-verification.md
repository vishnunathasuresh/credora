# ADR 0006: Rebuildable projections and independent verification

## Status

Accepted.

## Decision

The chain plus IPFS manifest is the canonical credential state. SQLite/API
rows, dashboards, sessions, search indexes, and audit views are projections.
Every projection row must retain its source registry, credential hash, block
number, block hash, transaction hash, and log index where available.

The synchronizer must be idempotent and reorg-aware:

1. Scan from a configured start block in bounded chunks.
2. Wait for the configured confirmation depth before treating events as
   finalized for product views.
3. Persist block hashes and rescan a bounded reorg window when a previously
   observed hash changes.
4. Rebuild projections from chain events; never repair a disagreement by
   editing the chain-derived value from the API.

Verification follows this order:

1. Parse and validate the credential reference.
2. Read the credential record from the selected registry.
3. Fetch the manifest from its `ipfs://` URI (or report metadata unavailable).
4. Normalize the manifest and recompute the versioned Keccak-256 hash.
5. Return `valid` only when the recomputed hash and all bound fields match.

The verifier should support a direct-RPC/direct-gateway mode so a third party
can bypass Credora's API entirely. Credora's API remains a convenience layer
for sessions, rate limits, projections, and user experience.

## Consequences

- API outages cannot change credential truth; they only affect convenience
  features.
- Reorgs and gateway failures become explicit, diagnosable states rather than
  silent false negatives.
- Search and analytics are eventually consistent and must be labeled as such.
- A self-hosted verifier can reproduce the same result from public sources.
