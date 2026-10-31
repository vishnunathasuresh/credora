# ADR 0013: Account-owned profiles and separately proven wallets

Status: accepted architecture, implementation in progress, 2026-10-29.

## Context

ADR 0012 introduces Google-authenticated accounts. A profile must be usable with
zero wallets, while public credential selections must still belong to a proven
recipient wallet. Existing ADR 0011 profiles and immutable credential references
must survive migration.

## Decision

Add account ownership to profiles and a wallet-association table. A new profile
can have no wallet. Preserve existing profile IDs, global unique handles,
publication choices, content, ordering and the 30-day handle cooldown. Legacy
profiles remain accessible through their existing wallet sessions until claimed;
once claimed, only their Google account can edit them.

An address can belong to at most one account. An account may associate multiple
wallets. Links demonstrate control at association time, not permanent wallet
control or identity verification. Do not publish the list of linked addresses.

To associate an address, require a validated account token plus a fresh,
server-generated one-use signature challenge. Bind it to internal account ID,
Supabase session ID, normalized address, action, configured application origin,
chain ID, nonce, issued-at and expiration. Verify the exact stored message and
signer, consume the challenge and insert the link in one transaction. Enforce
expiry and uniqueness under concurrent requests. No gas or transaction is needed.
Support EOA message signatures in this increment; no implied contract-wallet
support. Neither links nor account login grant issuer/admin/reviewer roles.

Linking a wallet with an unclaimed legacy profile explicitly offers importing
that profile. Require fresh wallet proof and explicit migration consent. If the
account has no profile, transfer application ownership while preserving the
legacy profile ID and its publication state. If both profiles exist, reject
with a clear conflict; do not merge, overwrite, delete content, or free a handle.
A wallet linked elsewhere is a conflict, never automatically reassigned.

Account credential lists query confirmed recipient projections for linked
wallets. Profile selection must validate that same binding; public summaries and
recipient decoration must join an eligible linked address or an unclaimed
legacy wallet. Account ownership does not rewrite issued learner addresses,
metadata or proof. Keep independent verification and temporary shares intact.

Removal requires both account authentication and fresh wallet proof. Remove
that wallet's featured selections and association atomically; relinking does
not republish them. No administrative reassignment or lost-key override is
introduced. Account recovery alone cannot unlink/reassign wallets or authorize
on-chain operations.

## Consequences and verification

Account/profile data and wallet links are authoritative application data,
requiring durable backups. Issuance rows remain rebuildable projections. The
registry and content-addressed metadata remain authoritative proof.

Test walletless profile creation, cross-account access, forged/replayed/expired
challenges, session binding, duplicate/concurrent links, legacy migration and
two-profile conflicts, selection redaction after unlink, case normalization,
and unchanged issuer/share authorization. A mocked authentication provider is
not evidence that live Google OAuth is configured.
