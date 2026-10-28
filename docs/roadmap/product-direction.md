# Credora product direction

Status: agreed product direction, 2026-10-29. Features below are planned unless
separately documented as implemented and verified. This document owns product
intent and sequencing; accepted ADRs own current protocol behavior.

## Purpose

Build a professional identity people are proud to share, backed by evidence
others can independently check. The long-term ambition is a professional
network with the reach and utility of LinkedIn. Begin with an identity,
portfolio, and credential experience that is useful before a user has followers.

People and achievements are the primary interface. Wallets and blockchain
support ownership and proof underneath an approachable web experience.

## Identity and profiles

- Give users handles such as `@bfrovrflw` and public URLs such as
  `/u/bfrovrflw`. Use a stable internal account ID independent of the handle.
- Support name, photo, headline, short bio, relevant links, education,
  experience, projects, and featured credentials with user-controlled ordering.
- Distinguish self-written profile claims from issuer-backed evidence.
- Start profiles private; require explicit publication and credential selection.
  Explain that publication associates identity with public wallet records.
- Support handle changes without transferring account or credential ownership.
  Define reserved names, uniqueness, cooldowns, old-link behavior, and
  impersonation handling before launch.
- Let people create a profile before connecting a wallet. Select authentication,
  wallet-linking, and recovery architecture before implementation. Account
  recovery must not silently transfer immutable credentials.

## Credential experience

Present the holder's workspace as **My credentials**, organized around
achievements rather than addresses. Prioritize achievement, issuer, evidence,
and actions. Keep technical proof details accessible.

The full credential page has an interactive lanyard badge inspired by
[React Bits Lanyard](https://reactbits.dev/components/lanyard), with drag,
swing, and flip interaction:

- Front: organization logo and name, credential title, recipient name and
  handle when published, issue date, and explicit proof status. Organization
  branding and credential details belong on the card itself.
- Back: description, awarded skills or level, credential reference,
  verification QR, and access to full proof details.
- After a real proof check succeeds, reveal the card with a short settling
  animation. Show distinct checking, unavailable/retry, absent, malformed,
  and mismatch states; reserve the successful reveal for matching proof.
- Provide a visible keyboard-accessible flip control, readable supporting
  details, and a static equivalent for reduced motion or unsupported devices.
- Use compact cards in libraries and profiles. Load 3D on demand for the full
  experience. Generate readable static social previews.

Keep proof validity, reviewed organization identity, and demonstrated control
of the recipient wallet distinct. A generic verified badge must not combine
these assurances. Profile handles and decorative branding do not rewrite the
issued record or become evidence that its proof matches.

## End-to-end journeys

Holder: join → claim handle → build profile → connect wallet when needed →
review credentials → choose what to publish → share profile or collection.

Visitor: open link without signing in → explore profile and credential →
independently verify proof without connecting a wallet.

Issuer: establish reviewed organization → draft and preview credential →
select recipient → confirm exact wallet → sign → wait for confirmed issuance →
notify recipient. Handle lookup resolves to a concrete wallet during draft
preparation; confirmation binds to that address. Later handle changes must not
redirect an issuance. An unpublished or unresolved recipient needs an explicit
fallback flow, not a guessed wallet.

## Sharing and organizations

- Give profiles a prominent share action, stable links, QR codes, and social
  previews. Offer curated credential collections alongside individual links.
- Preserve temporary selected-credential shares from
  [ADR 0009](../decisions/0009-expiring-selected-wallet-shares.md) as a separate
  option. A public profile is a new opt-in surface, not an automatic replacement.
- Explain that unpublishing a profile or expiring a share cannot recall copies
  or remove publicly issued proof.
- Add public organization pages, clear review status, program/achievement
  presentation, improved issuance, and recipient notifications.

## Network and return value

Start with new-credential notifications, organization updates, and optional
announcements when someone publishes a project or earned credential. Add
following people and organizations, search, and discovery after profiles and
sharing work end to end. Activity publication must respect explicit choices;
issuance alone does not authorize a public announcement.

Reporting, blocking, impersonation response, and moderation are prerequisites
for broader discovery and social activity. Defer unrestricted messaging,
general posting feeds, jobs, endorsements, and recommendation algorithms until
the core identity and issuer ecosystem is useful.

Students and early-career professionals, supported by colleges, clubs, training
programs, and projects, are the proposed initial audience. This remains a
market hypothesis rather than validated demand.

## Delivery order and acceptance gates

1. **Identity and profiles:** accounts, handles, editor, publication controls,
   public pages, and wallet association. A person can claim a handle and
   publish only selected information; unauthorized edits and handle collisions
   are rejected.
2. **Credentials and sharing:** library/detail redesign, interactive lanyard,
   featured projects and credentials, curated sharing, QR, and previews. A user
   can publish a first credential and share one polished link; visitors can
   verify without signing in. Reduced-motion and infrastructure-failure paths
   are usable and truthful.
3. **Organizations:** public pages, improved issuance, handle lookup, and
   notifications. Issuers confirm the exact recipient and recipients see
   confirmed issuance without automatic profile publication.
4. **Network:** follows, opt-in activity, search, discovery, reporting,
   blocking, and moderation. Private content stays excluded from discovery,
   activity, and previews.
5. **Opportunities:** investigate recruiting and matching after profile use
   and repeat issuer participation justify expansion.

Measure completed profiles, first published credentials, successful sharing,
visitor verification, and repeat issuance. Decide consent and data minimization
for analytics before collecting events.

## Architecture decisions required before implementation

Record new numbered ADRs for authentication/recovery, identity-to-wallet
association, and public-profile privacy/source-of-truth boundaries before
building those features. This product agreement does not silently supersede
existing ADRs or introduce a new credential protocol version.

The proposed boundary is: profile content, handle assignments, follows, and
publication preferences are authoritative application data requiring durable
backup and recovery. Chain-derived credential projections remain rebuildable;
credential existence and bound proof fields remain authoritative on-chain with
content-addressed metadata. Amend the current broad projection wording in
engineering/architecture guidance when the corresponding ADR is accepted.

Preserve existing credential versions, independent verification, immutable v1
records, private-key boundaries, and distinct infrastructure failure states.
Use the existing web app and shared package boundaries. Review the lanyard
dependency, assets/license, accessibility, and device performance during design
and implementation; the reference is a visual direction, not an installed
dependency or a completed integration.
