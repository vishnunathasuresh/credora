# Credora sprint plan

## Next product direction

The [agreed product direction](product-direction.md) owns the next roadmap:
identity and usernames, public profiles, the credential and lanyard experience,
sharing, organizations, then professional networking. Use its release gates for
new work. The sprint records below retain their existing implementation status;
they do not indicate that the new direction has shipped.

This plan keeps the public proof boundary authoritative: the web experience may
make verification easier to understand, but it must never imply that API or
database state is the source of truth.

## Current role model

- `SUPERADMIN` — protocol-level administrator. Can inspect projections,
  request reconciliation, approve organizations through one-time v3
  activation, and suspend organizations.
- `ORG_ADMIN` — organization admin. Its admin authority is enforced by the v3
  organization registry; the initial owner can issue immediately and manage
  the organization's issuer wallets.
- `ISSUER` — wallet authorized by the v1 registry or by an organization admin
  for that organization in the v3 registry.
- `LEARNER` / `VERIFIER` — users can hold/share public proof links and verify
  credentials without administrative access.

## Organization authority model

The target model is recorded in [ADR 0010](../decisions/0010-organization-controlled-issuer-authority.md).
The repository now contains the v3 registry, API, verifier, and organization
workspace paths. Deployments must configure the separate v3 registry before
organization issuance is available.

- [x] Implement `OrganizationCredentialRegistry` with one-time activation,
      initial owner issuance, organization-admin delegation, and suspension.
- [ ] Add contract security tests and independently review the v3 registry
      before deployment.
- [x] Make organization activation contingent on a confirmed registry event
      and project chain authority into the API.
- [x] Let organization admins grant and revoke their own issuer wallets
      on-chain; block issue calls for inactive or suspended organizations.
- [x] Keep superadmin review and suspension, but remove superadmin
      authorization from routine single and bulk issuance.
- [x] Add org-scoped members, optional internal approval policies, and
      per-item bulk issuance recovery in the API and web workspace.
- [x] Add organization-bound credential hash v3 while preserving v1 and v2
      selective-disclosure verification without reinterpretation.

## Sprint 01 — Public verification confidence (complete)

Goal: make the first-time verifier feel oriented, informed, and safe.

- [x] Audit the web surface with Apple Design and Impeccable guidance.
- [x] Add an accessible compact-screen navigation path instead of hiding routes.
- [x] Give credential-hash entry inline validation and an explicit checking state.
- [x] Distinguish verified, not found, proof mismatch, metadata unavailable, and
      ledger unavailable in the result surface.
- [x] Add keyboard focus, minimum touch targets, semantic status messaging, and
      reduced-motion-safe feedback.
- [x] Add route-level loading and retry affordances for slow ledger responses.

Exit signal: a verifier can submit a valid or invalid reference and understand
what happened, what is authoritative, and what to do next at any screen size.

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

## Sprint 03 — Holder wallet and sharing (web UI implemented)

Goal: make credentials portable for learners without weakening privacy.

- [x] Build the website wallet list and credential detail entry points.
- [x] Add share links that expose only public proof and approved metadata.
- [x] Keep sensitive details local and document the selective-disclosure boundary.
- [x] Add recovery/empty/offline states that do not claim a credential is invalid.
- [x] Add an expiring one-QR share for the holder-selected public credential set.
- [x] Reverify each included proof independently when a verifier opens a share.

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

## Organization enrollment and authority — implemented; deployment QA pending

- Applicants submit legal name, registration reference, official website, and
  HTTPS evidence for one-time superadmin review.
- Approval is recorded only after a confirmed v3 registry activation. The
  applicant wallet becomes the initial admin and issuer in that transaction.
- Organization admins manage team roles, issuer keys, versioned templates, and
  optional internal review. Single and atomic batch issuance require no
  platform-admin approval.
- Superadmins suspend or restore organizations on-chain; API status remains a
  projection of registry state.

Deployment exit evidence still needed: Foundry contract tests, independent
contract review, fresh-registry browser issuance, and verification against the
deployed v3 address.

The web UI implementation is complete for this phase.
