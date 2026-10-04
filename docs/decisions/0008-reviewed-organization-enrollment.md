# ADR 0008: Reviewed organization enrollment

## Status

Accepted and implemented for the API-backed web application.

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
  rejects it. Only approval creates an active organization record and grants
  `ORG_ADMIN` to the applicant address. The API enforces this role gate and
  records review actions in its audit projection.
- The request QR encodes only a random request reference in a protected
  superadmin URL and can be downloaded as PNG for sharing. The review API
  requires a superadmin session. Scanning,
  copying, or guessing a request URL cannot create an organization or grant a
  role. Pending requests are unique by applicant address and organization name.
  Intake is rate-limited per network and stops accepting requests at the
  configured pending-queue ceiling (defaults: five requests per IP per day,
  100 pending requests).
- Superadmins can suspend or reactivate an organization. Active organization
  roles are resolved against the current database status on each API request,
  so an old session cannot retain organization operations after suspension.
  This does not revoke a separate on-chain issuer authorization.
- Organization membership and issuance grouping are API records, not chain
  records. The connected organization wallet must separately be authorized as
  an issuer by the credential registry before it can issue. Organization
  approval never bypasses the contract's issuer check.
- `API_ORG_ADMIN_ADDRESSES` remains a trusted operator bootstrap override for
  existing deployments; ordinary applicants do not control this setting.

## Consequences

The enrollment queue and organization profile require a persistent SQLite
volume and backups. Review decisions are centralized operational access
decisions, not public proof or legal-entity verification. The current UI binds
one approved organization to its applicant admin wallet; it does not invite
additional team members. Future organization registry work may migrate these
relationships on-chain without changing v1 credential hashes or records.

## Evidence

The schema is in `apps/api/src/migrations.ts`; applicant, review, status, and
organization-scoped issuance routes are in `apps/api/src/index.ts`. Web
application and approval surfaces live in `apps/web/src/components/issuer-workspace.tsx`
and `apps/web/src/components/admin-workspace.tsx`.
