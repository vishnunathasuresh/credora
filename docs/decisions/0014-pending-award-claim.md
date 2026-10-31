# ADR 0014: Private pending award claim for a pilot

## Status

Proposed, 2026-10-31. This is a design for review, not an accepted protocol,
implemented feature, completed pilot, or provider selection. It depends on
[ADR 0010](0010-organization-controlled-issuer-authority.md),
[ADR 0011](0011-profile-identity-and-publication.md),
[ADR 0012](0012-google-account-authentication.md), and
[ADR 0013](0013-account-wallet-association.md), and the
[product direction](../roadmap/product-direction.md). It does not change their
accepted rules.

## Context

An issuer may know that someone earned an award before that person has a
wallet or a public profile. Guessing an address from a name, email, or handle
would risk an irreversible issuance to the wrong address. A private pending
award lets the intended recipient participate before issuance; it is not a
credential, proof of achievement, public announcement, or on-chain record.
The issuer still decides whether to issue, and an authorized issuer wallet
still signs the existing issuance transaction.

The current organization registry accepts a credential hash, learner address,
and metadata URI, checks organization and issuer authority, and records the
issuer and learner. The v3 hash binds the organization, issuer, learner and
metadata URI; existing API issuance preparation, optional review, and
confirmation checks operate on concrete payloads. ADR 0012 account sign-in and
ADR 0013 signed wallet association are separate capabilities. Their design is
accepted but their implementation is in progress. No existing code should be
assumed to implement the claim workflow below.

## Proposed decision

### Private invitation and recipient authentication

For the pilot, the issuer creates a private award draft with an opaque random
ID, organization scope, minimal award details and a version. It is stored as
authoritative application data, not in public metadata, the chain, search,
public profiles, or a chain projection. Organization access requires the
existing scoped operational authorization; a Google account or invitation does
not grant issuer authority.

The intended recipient signs in under ADR 0012 and deliberately gives the
issuer a short-lived, single-use, high-entropy recipient invitation code through
an independently agreed channel. The code resolves server-side to the stable
internal account ID, not to an email, handle, or address. It reveals no award
and is never a public account lookup mechanism. The issuer verifies the
recipient through its own appropriate process before binding that account to
the award; code possession and Google login do not establish real-world
identity or eligibility. The server atomically consumes the code and binds the
award to that one account. A wrong binding requires cancellation and a new
invitation, not silent reassignment. No notification service is selected: the
recipient can return to an authenticated private inbox, and any future
notification must contain no sensitive award details or bearer credential.
This interaction requires an authenticated recipient before the issuer can
bind a pending award; the pilot does not promise unsolicited email invitations.

Store only a keyed digest of the code, its purpose, expiry, use state and
account binding; generate it with a cryptographically secure RNG. Show the code
once, use TLS, never put it in a URL, analytics, logs, referrers or third-party
scripts, and rate-limit creation and redemption. It expires, can be invalidated
by its account before use, and cannot be reused or substituted across accounts
or purposes. Responses must not permit account enumeration. Protect the code as
a secret: interception can cause an award to be bound to the wrong account;
the issuer's independent recipient check is therefore essential. A recipient
who notices a misdirected award can decline it; support must not disclose it to
another account based solely on a claimed email address.

After binding, every read and mutation requires a validated account session
and an authorization check against the bound internal account ID; a code alone
never opens an award. Auth outages are unavailable, not proof that an account
or award does not exist. The recipient can view, decline, or propose an address;
no action automatically publishes a profile or creates a credential.

### Address confirmation and issuance

1. The recipient associates a wallet using ADR 0013's fresh account- and
   session-bound one-use signature challenge, then explicitly selects a linked
   address for this award. This proves control at association time, not legal
   identity or continuing control. For this pilot, support the EOA signature
   scope of ADR 0013; contract-wallet support needs a separate decision.
2. Show the recipient the complete normalized address and chain, warn that
   issuance is immutable and keys must be kept recoverable, and require an
   explicit confirmation tied to the award version and address. A handle is
   never the binding. If the link is removed before issuer confirmation, or
   the award or selected address changes, invalidate the recipient confirmation.
3. The issuer reviews the award and the complete exact address, chain and
   organization, and explicitly confirms them. Freeze a versioned issuance
   snapshot containing the recipient confirmation, address, chain, registry,
   organization, signer and all credential fields. Any change invalidates both
   confirmations and any approval; restart review. Do not resolve a handle or
   switch addresses after confirmation. Require the wallet link still to belong
   to the account when the snapshot is frozen; later unlinking cannot rewrite
   a submitted or issued record.
4. Prepare metadata and the existing versioned canonical hash using that
   exact snapshot. The issuer reviews the actual payload and signs through the
   existing issuance path; optional organization review freezes the same hash
   under ADR 0010. The API must compare the resulting chain, registry,
   transaction sender, organization, hash, learner and metadata URI against
   the frozen snapshot and authoritative registry event/record at the
   deployment's confirmation depth. Do not claim success from a submitted
   transaction or database flag. Contract authorization remains decisive.
   Verify metadata and the versioned hash independently as usual. A Keccak
   hash is not an IPFS CID. Publication of content-addressed metadata may make
   its contents public even before a transaction confirms; show and minimize
   this exposure before upload.

These checks govern Credora's application workflow. An independently authorized
issuer can call the registry directly, bypassing the pending award and its
application confirmations; they are not an on-chain consent or uniqueness
constraint. The registry cannot prove that a recipient consented to a claim.

### Lifecycle, concurrency and recovery

Use explicit versioned states: draft, bound/awaiting recipient, recipient
confirmed, issuer confirmed/preparing, submitted, confirmed, declined,
cancelled and expired. A failed preparation can return to a reviewable state
only if no external submission is possible; a pending or unknown submission
must be reconciled before a replacement is allowed. Issuer cancellation or
expiry before submission prevents further application submission. Once a
transaction may have been broadcast, cancellation cannot recall it: display
pending/unknown and reconcile through the chain. A reorg can move a confirmed
projection back to pending or unknown until the configured confirmation policy
is satisfied again. Declining or deleting an application record cannot revoke
an already issued credential.

Use transactional compare-and-swap on award version and state, unique constraints
for one active binding and one active issuance attempt per award, and a
client-generated idempotency key scoped to actor, operation and award. Persist
the key and request digest with the result atomically; same key and payload
returns the same result, while reuse with a different payload conflicts. Code
consumption, account binding and state transition are one transaction.
Concurrent recipient choices, confirmation, cancellation and expiry have one
winner; stale requests must reload and explicitly reconfirm. Record the frozen
snapshot and transaction hash as soon as known, reconcile uncertain broadcasts
and chain events before retrying, and never create a second attempt merely
because an RPC or API response timed out. A database transaction cannot be
atomic with wallet broadcast or chain finality; this design cannot guarantee
exactly-once issuance against external or direct contract calls. Escalate
ambiguous cases for reconciliation rather than asserting no issuance occurred.

Pending award details, account bindings, consent snapshots and operational
idempotency/audit records are authoritative application data and require
access-controlled durable backups, tested restores, and a documented retention
and deletion schedule, including backups. Chain-derived issuance projections
remain rebuildable. Preserve enough minimal records to reconcile submitted
transactions and investigate disputes; delete expired codes and unnecessary
PII promptly. Set concrete retention periods and restore/reconciliation
procedures before pilot use. Deleting private data cannot erase disclosed
metadata or chain history. Limit fields and operator access; never store private
keys, OAuth tokens, invitation secrets, or unnecessary PII in logs, metadata or
contracts. Encrypt sensitive stored data and backups with managed operational
key rotation and access controls; avoid logging award contents.

Account recovery restores application access only. If a recipient loses a wallet
key before submission, they may link a different wallet and restart recipient
and issuer confirmation on a new snapshot, subject to ADR 0013's existing
linking rules. A lost key cannot be used to unlink or reassign the old wallet
without its fresh proof. After broadcast, reconcile first; after issuance, no
account recovery, support action, or new link transfers the credential or
changes its learner address. A possible issuer reissue to a newly proven
address is a new, separately confirmed credential, not a transfer or correction
of the old one. The old record remains valid under current rules; there is no
current credential revocation. Do not imply that reissue invalidates it. Any
revocation, supersession or key-recovery attestation requires a separately
specified append-only protocol.

### Wallet choices

| Approach | Usability and cost | Recovery, portability and trust |
| --- | --- | --- |
| Injected self-custody wallet (proposed pilot baseline) | Recipient installs or already has a wallet, manages keys and signs an association challenge; issuer pays its applicable transaction costs. No new wallet provider fee is assumed. | Recipient controls recovery and key security; loss may be permanent. Existing key/address can generally be used across compatible applications, subject to wallet and chain support. |
| Managed or embedded MPC wallet | May reduce setup friction, but account, signing, recovery, integration, usage and potentially transaction sponsorship costs depend on the specific provider and deployment. MPC alone does not specify who controls shares or recovery. | Evaluate share custody, recovery quorum, lockout, export of keys or migration of addresses, provider availability and compromise model. Portability and self-custody cannot be assumed. |
| Platform custody | May offer the simplest account experience but adds operating, security, support, insurance and potentially regulatory costs and concentration of authority. | Platform controls or can access signing authority; recovery depends on its policies. Exit and address portability depend on key export and governance. It conflicts with the current no-private-keys-in-API boundary unless a separately reviewed architecture changes it. |

The proposed flow **does not yet remove recipient wallet friction**: a recipient
must connect a compatible wallet, understand and safeguard its keys, and sign.
No provider, fee, recovery guarantee, account-abstraction support, or
sponsorship is selected or promised. Compare actual offers and security models
before any later decision; platform custody is not authorized by this proposal.

## Authority and failure states

The private award is an issuer assertion and workflow record; account login
proves a session, wallet association proves control at a point in time, and
neither proves the award or grants on-chain authority. Chain state and
content-addressed metadata remain the independent proof sources. UI must show
separately: sign-in unavailable; invitation expired/used/invalid or recipient
mismatch without leaking account existence; award declined/cancelled/expired;
wallet missing, link conflict or challenge expired; recipient or issuer
confirmation stale; issuer authority inactive/unavailable; metadata upload or
retrieval unavailable; transaction awaiting signature, pending, reverted or
outcome unknown; chain/RPC unavailable or reorg reconciliation; proof absent,
malformed or mismatched; and confirmed. An infrastructure outage must not be
presented as invalid proof or successful issuance. A pending award must never
appear as a verified credential.

## Migration and compatibility

This is an additive application workflow, not a new credential version or a
registry migration. Existing direct issuance and v1/v2/v3 proofs retain their
current verification paths and semantics; existing wallet-first and account
flows must continue to work. No historical credential or address is silently
backfilled, transferred, or rebound to a claim. Deploy private schema changes
with a reversible rollout before enabling new writes, backup and restore checks,
and an explicit plan for handling in-flight attempts if the feature is
rolled back. Do not delete authoritative pending records as a rollback shortcut.
Existing public verification remains independent of the claim API and login.

Credora's versioned hashes and registry are not, by themselves, a claim of W3C
Verifiable Credentials or Open Badges interoperability. Any future standards
mapping, issuer identifiers, presentation, and verification semantics need a
separate compatibility design and tests; this proposal does not change those
formats or promise interoperability.

## Open decisions and implementation gates

- Agree on the pilot's recipient identity check and out-of-band code exchange,
  expiry, rate limits, accessibility, support and misbinding response; validate
  that the private inbox is usable without creating an enumeration channel.
- Choose exact retention periods, audit fields, deletion and backup expiry,
  encryption/key management, data access policy, and restore/reconciliation
  runbooks. Review applicable privacy and operational obligations.
- Decide confirmation depth, handling of reorgs, broadcast ambiguity, direct
  registry issuance, duplicates and issuer misissuance, and whether a later
  protocol should enforce recipient consent or uniqueness on-chain.
- Validate ADR 0012/0013 implementation and live configuration; specify EOA
  chain/network behavior and decide separately whether contract wallets,
  managed wallets or recovery mechanisms are needed. Test genuine key-loss
  and recovery messaging with users before introducing any custody choice.
- Before implementation, agree the data model, transactional constraints,
  idempotency scope, API authorization and threat model; test races, replay,
  misbinding, stale confirmation, privacy, outages, interrupted broadcasts,
  reorgs, restore, and unchanged independent verification. Test actual issuer
  signing and confirmation against a deployed test registry, plus an accessible
  real-browser recipient journey. A mock or source review is not pilot evidence.
- Define success, informed consent, issuer training, support and a bounded pilot
  rollout only after these decisions; acceptance of this ADR alone does not
  establish readiness, standards compliance, or completion.
