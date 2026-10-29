# ADR 0012: Google account authentication through Supabase

Status: accepted architecture, implementation in progress, 2026-10-29.

## Context

The agreed identity journey starts before a wallet is connected. The product
owner selected Google sign-in through Supabase Auth. ADR 0011's wallet-keyed
profile is transitional; Google authentication must not become blockchain or
organization authority.

## Decision

Use Supabase Auth Google OAuth with PKCE for the web account session. Use the
maintained Supabase JavaScript client with its standard browser session storage,
a fixed same-origin callback, and no user-controlled external redirect. The SDK
owns refresh and auth-state synchronization. Load it only in account surfaces;
public proof verification does not depend on authentication.

The browser sends the Supabase access token as a bearer token to account API
routes. The API validates it online using Supabase Auth `getUser(token)` against
the configured project, with the public publishable key. It never trusts decoded
JWT claims, a browser-supplied account ID, email, or display name. Authentication
service failure is unavailable, not an invalid profile. No secret/service-role
key is needed. Tokens, OAuth codes and signatures must not be logged.

Map the verified Supabase user ID, namespaced by the configured project issuer,
to a random immutable internal account ID. Create the mapping transactionally.
Do not merge accounts by email or import Google profile data automatically.
Existing wallet sessions remain a separate credential/issuer capability and do
not authenticate a Google account.

Use standard SDK PKCE rather than a custom session-encryption/BFF system in this
increment. Browser-readable sessions carry the normal XSS exposure of browser
OAuth clients; output encoding and avoiding untrusted scripts remain required.
Account mutations use explicit bearer headers, not automatically attached auth
cookies, so cross-origin requests do not acquire account authority implicitly.
Keep exact CORS allowlists and existing body/rate limits. Do not claim HttpOnly
session protection or instantaneous logout revocation of an already-issued token.

Google/Supabase recovery restores application account access only. Credora does
not implement an alternate recovery override, email matching, or wallet-key
recovery. Wallet linking and legacy migration require their own fresh signature
under ADR 0013. Privileged role and issuance routes still require existing wallet
authorization and authoritative registry checks.

## Configuration and consequences

Public web configuration is `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`; API configuration is `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`. Both sides must select the same project. Configure
Google provider credentials in Supabase, its callback in Google, and exact web
callback URLs in Supabase's redirect allowlist. Never expose Google client
secrets or Supabase service-role keys in these variables.

Missing configuration yields a useful unavailable sign-in state without breaking
public pages or legacy wallet workflows. Production OAuth completion requires
operator configuration and a real-browser acceptance check; local mocks prove
API and callback behavior only. Supabase's identity store and Credora's account,
profile and association database require coordinated backup/recovery procedures.

The more complex server-only BFF alternative is documented in the architecture
proposal but is not selected here. This ADR takes precedence over that proposal.

References: [Google provider](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
