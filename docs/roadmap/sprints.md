# Credora sprint plan

This plan keeps the public proof boundary authoritative: the web experience may
make verification easier to understand, but it must never imply that API or
database state is the source of truth.

## Website role model

- `SUPERADMIN` — protocol-level administrator. Can authorize issuer wallets,
  inspect projections, and request reconciliation. Authority is still checked
  against the registry.
- `ORG_ADMIN` — organization operator. Can access organization operations and
  issuance history. It cannot issue unless its wallet is also authorized as an
  on-chain issuer.
- `ISSUER` — wallet authorized by the registry to sign credential issuance.
- `LEARNER` / `VERIFIER` — users can hold/share public proof links and verify
  credentials without administrative access.

## Sprint 01 — Public verification confidence (complete)

Goal: make the first-time verifier feel oriented, informed, and safe.

- [x] Audit the web surface with Apple Design and Impeccable guidance.
- [x] Add an accessible mobile navigation path instead of hiding routes.
- [x] Give credential-hash entry inline validation and an explicit checking state.
- [x] Distinguish verified, not found, proof mismatch, metadata unavailable, and
      ledger unavailable in the result surface.
- [x] Add keyboard focus, minimum touch targets, semantic status messaging, and
      reduced-motion-safe feedback.
- [x] Add route-level loading and retry affordances for slow ledger responses.

Exit signal: a verifier can submit a valid or invalid reference and understand
what happened, what is authoritative, and what to do next on desktop or mobile.

## Sprint 02 — Issuer workspace foundation (website complete)

Goal: give an authorized organization a small, auditable issuance workflow.

- [x] Define the issuer dashboard information architecture and empty states.
- [x] Add organization/issuer authorization status from the registry projection,
      clearly labeled as projection data.
- [x] Implement draft → metadata upload → transaction pending → confirmed states.
- [x] Surface rejected, reverted, upload-failed, and ledger-unavailable states as
      separate recovery paths.
- [x] Add web wallet orchestration without sending private keys to the API.
- [x] Add a guarded website admin flow for on-chain issuer authorization.
- [x] Split superadmin, organization-admin, issuer, learner, and verifier
      website surfaces.
- [x] Add tests for immutable v1 issuance and duplicate/hash mismatch prevention.

Exit signal: an issuer can prepare one credential, see every infrastructure
state, and reach a confirmed on-chain record without private key material ever
entering the API.

## Sprint 03 — Holder wallet and sharing (website complete)

Goal: make credentials portable for learners without weakening privacy.

- [x] Build the website wallet list and credential detail entry points.
- [x] Add share links that expose only public proof and approved metadata.
- [x] Keep sensitive details local and document the selective-disclosure boundary.
- [x] Add recovery/empty/offline states that do not claim a credential is invalid.

The mobile implementation is intentionally paused until the website product is
stable.

Website exit signal: an admin can authorize an issuer, an issuer can issue an
immutable credential, and a learner can copy a public verification link.

Exit signal: a learner can find a credential, understand its proof source, and
share it with a verifier without handing over unnecessary PII.

## Sprint 04 — Independent verification hardening (complete)

Goal: validate the system when convenience infrastructure is unhealthy.

- [x] Add a direct RPC + IPFS verification path alongside the API projection.
- [x] Add API, ledger, gateway, malformed-input, and proof-mismatch end-to-end
      coverage.
- [x] Add observability for freshness and rebuildability of projections.
- [x] Re-run accessibility, responsive, and visual audits against real states.

Exit signal: API outage, stale projection, gateway outage, and invalid metadata
are visibly distinct and independently diagnosable.

The website is the finished MVP target for this phase. Mobile remains paused by
choice; its shared protocol packages remain typechecked and ready for a later
native pass.
