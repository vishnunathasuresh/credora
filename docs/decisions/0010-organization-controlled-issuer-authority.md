# ADR 0010: Organization-controlled issuer authority

## Status

Accepted. This decision supersedes ADR 0004's requirement for an organization
admin to authorize issuer keys separately from organization activation. It is a
target architecture; implementation and production activation are still
required before the product can claim this behavior.

## Context

Today, the API can approve an organization and grant its applicant an
`ORG_ADMIN` role, while the v1 `CredentialRegistry` separately grants the
global `ISSUER_ROLE`. This makes ordinary issuance depend on a Credora
superadmin and leaves organization suspension unable to stop a wallet that
remains authorized on-chain.

The accepted product rule is one-time institutional approval followed by
organization-controlled operations. Credora verifies an organization and
activates its initial authority once. That owner can issue immediately and
manage the organization's signing wallets without per-credential platform
approval. Credora retains enrollment review, trust and security response, and
exceptional organization suspension.

Credora already assigns credential protocol version 2 to selective disclosure.
Organization-bound credentials therefore need a new credential hash version;
the product milestone called “V2” must not be confused with the on-chain
credential payload version.

## Decision

### Organization activation and authority

- Keep the deployed v1 registry and all existing v1 proofs unchanged.
- Introduce a versioned organization-aware registry. Its records bind an
  opaque `organizationId`, the issuing wallet, learner, metadata URI, issue
  time, and credential hash.
- The first approved organization owner is also an issuer at activation. The
  superadmin's activation transaction registers the organization, its public
  metadata reference, and its initial owner/admin wallet. The organization is
  not active for issuance until that transaction is confirmed on the selected
  registry.
- Organization admins can add and remove the organization's signing wallets
  on-chain and manage the organization's operational members and roles in the
  API. A signing wallet may be delegated to more than one organization.
- The contract checks both organization activity and issuer membership on
  every issuance. API roles and projections can improve operations but cannot
  grant, retain, or override this authority.
- Credora superadmins can register an approved organization and suspend or
  restore an organization. Suspension blocks future issuance through the
  registry. Ordinary issue, bulk issue, template, and team operations do not
  require a Credora superadmin transaction.
- Organization suspension is not credential revocation. Already issued
  records remain verifiable; a separate append-only credential-status
  protocol is required for revocation or correction.

### Credential and organization versions

- Leave v1 hashes and records unchanged.
- Leave v2 selective-disclosure hashes and manifests unchanged.
- Add organization binding in credential hash version 3, including the stable
  `organizationId` and issuer wallet in the canonical payload. Solidity and
  TypeScript must use the same versioned ABI encoding and fixtures.
- Organization identity and signing-wallet authorization are public chain
  state. Organization profile metadata may be updated through versioned
  on-chain metadata references; no applicant contact details, evidence, or
  learner PII belong on-chain.
- A verifier checks the selected registry version, v3 hash binding, active
  organization record at issuance, and issuer membership at issuance. Current
  organization status is displayed separately from historical proof validity.
- A new registry or append-only companion is required. Do not change the v1
  `Credential` struct, reinterpret old issuer addresses as organization
  members, or silently route v1/v2 records through the v3 verifier.

### Organization operations

- Organization membership, departments, invitations, templates, batch
  preparation, approval policy, and audit detail are application projections
  with organization-scoped server authorization. They never substitute for
  on-chain signer authorization.
- Internal per-credential or batch approvals are optional organization
  policy. Any policy advertised as cryptographically enforced must be enforced
  by the organization's signing authority, such as an organization multisig
  or threshold signer; a web-only approval step cannot constrain a wallet
  that can call the registry directly.
- Single and bulk issuance use the same organization and signer checks. Bulk
  processing reports status per credential and is retry-safe; unless a future
  batch contract explicitly guarantees atomicity, partial success must be
  shown as partial success.
- Credential correction, revocation, expiry, and supersession are append-only
  status events under a separately versioned protocol. This ADR does not make
  issued credentials mutable.

## Activation and recovery states

1. Application is submitted and reviewed off-chain; evidence and reviewer
   notes stay access-controlled.
2. Approval prepares an activation transaction for the approved application,
   opaque organization ID, initial owner wallet, and public metadata URI.
3. The approved owner may issue only after the activation event is confirmed
   on the configured chain.
4. The API derives active organization and issuer projections from registry
   events and reconciles them from chain history. A failed or pending
   activation must remain visibly distinct from an active organization.
5. Issuer additions, removals, metadata updates, and suspension changes are
   reflected only after their relevant chain transactions are confirmed.
6. If the API is unavailable, an authorized organization wallet can still
   exercise the on-chain authority directly. If the registry/RPC is
   unavailable, the application must not claim activation, issuance success,
   or suspension finality based only on API state.

## Consequences

- Organization approval includes one platform-admin activation transaction;
  it does not include future per-credential authorization.
- Issuer-key management and organization identity become independently
  auditable from chain history.
- The organization admin's governance key is a high-value authority. Product
  setup must explain key custody, recovery, optional multisig, and key
  revocation before enabling production issuance.
- Suspension is effective for future transactions only when finalized by the
  registry. The API may immediately restrict its own write routes while a
  suspension is pending, but must show that chain enforcement is still
  pending.
- Legacy organizations require an explicit reviewed migration and activation
  transaction. Their historical v1/v2 credentials remain attributed to their
  original issuer wallets unless a future protocol supplies a verifiable
  migration statement.

## Migration and implementation gates

1. Specify and deploy the organization-aware registry and v3 canonical hash;
   publish its address and chain configuration separately from v1.
2. Add activation, issuer membership, suspension, and metadata event
   projections with reorg-safe reconciliation.
3. Change superadmin review so “approved” is not “active”; show activation
   pending until the chain event is confirmed.
4. Add organization member/role and issuer-wallet management, backed by
   current on-chain authorization checks on every sensitive API operation.
5. Update issuance, bulk issuance, and verification to handle v1, v2, and v3
   explicitly, preserving distinct proof, organization-status, and
   infrastructure states.
6. Gate production rollout on cross-language hash fixtures, contract
   authorization and suspension tests, API projection/reorg tests, and
   end-to-end issuance and independent verification against a fresh registry.

## Acceptance criteria

- A newly activated organization owner can issue without a second Credora
  superadmin action.
- An organization admin can authorize and revoke that organization's issuer
  wallets; an unrelated organization cannot alter those grants.
- An unauthorized wallet and every wallet of a suspended organization are
  rejected by the registry.
- The API cannot mark an organization active or an issuer authorized without
  corresponding confirmed chain state.
- A verifier can independently establish organization binding for v3 while
  v1 and v2 records continue to verify under their original rules.
- No application-only approval or database flag can bypass registry checks.
