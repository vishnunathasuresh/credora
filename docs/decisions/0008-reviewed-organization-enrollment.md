# ADR 0008: Reviewed organization enrollment

## Status

Accepted; its original API-only activation behavior is superseded by
[ADR 0010](0010-organization-controlled-issuer-authority.md). Application
intake and evidence review remain in effect; approval now requires a confirmed
organization-registry activation transaction.

## Context

The v1 credential registry authorizes issuer wallets, but it does not register
organizations or represent organization administrators. `ORG_ADMIN` is an
operational website role. Letting an applicant grant that role to itself would
turn a self-reported organization name into account authority.

## Decision

- A connected wallet may submit one pending application containing an
  organization name and a self-reported HTTPS website. The wallet session
  proves control of the requesting address; it does not prove legal identity,
  website ownership, or issuer authority.
- A superadmin reviews every request, checks the organization and applicant
  wallet through an independent trusted source, and explicitly approves or
  rejects it. Approval requires on-chain activation; the initial admin and
  issuer roles are granted in that transaction. The API records the confirmed
  decision as an operational projection.
- The request QR encodes only a random request reference in a protected
  superadmin URL and can be downloaded as PNG for sharing. The review API
  requires a superadmin session. Scanning,
  copying, or guessing a request URL cannot create an organization or grant a
  role. Pending requests are unique by applicant address and organization name.
  Intake is rate-limited per network and stops accepting requests at the
  configured pending-queue ceiling (defaults: five requests per IP per day,
  100 pending requests).
- Superadmins can suspend or reactivate an organization on-chain. API state is
  updated only after the registry confirms the corresponding status.
- Organization admins manage team and issuer permissions through the
  organization registry. Organization approval makes the initial owner able
  to issue immediately; it never requires a second platform-admin action.
- `API_ORG_ADMIN_ADDRESSES` remains a trusted operator bootstrap override for
  existing deployments; ordinary applicants do not control this setting.

## Consequences

The enrollment queue and organization profile require a persistent SQLite
volume and backups. Review decisions are centralized operational access
decisions, not public proof or legal-entity verification. The registry records
organization authority without changing v1 credential hashes or records.

## Evidence

The schema is in `apps/api/src/migrations.ts`; applicant, review, status, and
organization-scoped issuance routes are in `apps/api/src/index.ts`. Web
application and approval surfaces live in `apps/web/src/components/issuer-workspace.tsx`
and `apps/web/src/components/admin-workspace.tsx`.
