# Identity first onboarding audit

Status: source-based UX audit and implementation plan, 2026-10-29. No browser
session, screen reader, or measured accessibility review was performed for this
document.

## Direction

Credora should begin with a person choosing a public handle and building a
professional profile. Google sign-in through Supabase Auth is the account entry
point. A wallet is a later, optional association used to find credentials and
publish selected issuer-backed achievements. Issuer transaction signing remains
a separate wallet-authenticated workflow.

This direction follows the agreed product sequence: join, claim a handle, build
a profile, connect a wallet when needed, review credentials, choose what to
publish, and share. The current product direction requires architecture
decisions for authentication/recovery, identity-to-wallet association, and
profile privacy/source of truth before those features are implemented. Google
and Supabase Auth are the selected UX direction for this plan; record the
resulting account, recovery, and data ownership details in the relevant ADRs
before implementation. See [product direction](../roadmap/product-direction.md)
and [ADR 0011](../decisions/0011-profile-identity-and-publication.md).

## What the source currently ships

| Area | Current behavior in source | Gap for identity-first onboarding |
| --- | --- | --- |
| Landing and entry | `/` presents a profile and handle in explicitly illustrative previews. “Build your profile” and “Get started” lead to `/profile`. [Home page](../../apps/web/src/components/home-page.tsx:5), [root navigation](../../apps/web/src/routes/__root.tsx:41) | There is no signup route. The first action goes to a wallet-gated editor. |
| Authentication | `connectWalletSession()` asks for an injected browser wallet, requests an API challenge, signs it with `personal_sign`, verifies it, then stores the bearer session in `sessionStorage`. [Wallet session](../../apps/web/src/lib/wallet-session.ts:18), [API auth](../../apps/api/src/index.ts:1093) | No Google/Supabase Auth UI, account creation, account session, account recovery, or email identity is present. |
| Handle | The required handle is edited inside the profile form and is only checked when saving. API normalization lowercases it; accepted syntax is 3–30 lowercase ASCII letters, digits, or underscores, excluding reserved routes. Uniqueness is enforced on save and a changed handle has a 30-day cooldown. [Editor](../../apps/web/src/components/profile-page.tsx:408), [API validation](../../apps/api/src/index.ts:995), [save](../../apps/api/src/index.ts:1325) | No availability check or standalone claim step. A collision is discovered only after the full form is submitted. |
| Profile | `/profile` loads and saves one profile by authenticated wallet. It includes name, headline, bio, HTTPS avatar URL, links, projects, experience, education, selected credentials, and a publication toggle. New profiles default to private. [Editor load/save](../../apps/web/src/components/profile-page.tsx:224), [API profile](../../apps/api/src/index.ts:1282) | Identity is not independent of a wallet. The editor is a long form rather than a staged first-run path, and has no completion checklist or profile preview during setup. |
| Wallet and credentials | `/wallet` requires the wallet that received the credentials. It shows a wallet-address heading and credential library; it distinguishes a failed load from an empty list. [Wallet page](../../apps/web/src/components/holder-wallet.tsx:93) | No optional wallet-link step exists in an account flow. A user without credentials has no account-first path. A holder does not issue their own credential; issuers create records. |
| Publication and proof | Profile publication is explicit. The editor warns that publishing can connect identity to public wallet records and that unpublishing cannot remove public proofs or copies. Selected credentials must be confirmed for the authenticated wallet. [Publication UI](../../apps/web/src/components/profile-page.tsx:797), [API validation](../../apps/api/src/index.ts:1341) | The warning is present, but future onboarding must explain the distinction before linking/publishing and keep profile claims separate from issuer-backed proof and wallet control. |
| Public profile | `/u/$handle` loads only a published profile from `GET /profiles/{handle}`. It shows user-authored fields and separately labeled issuer-backed credentials; each credential links to independent verification. `Share profile` uses native share or copies the URL. [Route](../../apps/web/src/routes/u.$handle.tsx:4), [profile view/share](../../apps/web/src/components/profile-page.tsx:864), [public API](../../apps/api/src/index.ts:1443) | No profile QR action. The root document has generic metadata, with no handle-specific title, description, Open Graph image, or social preview contract. |
| Credential sharing | Individual credential QR/link and temporary selected-credential shares are implemented. The QR encodes a public verification/share URL, not a profile. [Credential share](../../apps/web/src/components/credential-share.tsx:26), [share route](../../apps/web/src/routes/share.$token.tsx:4) | These are useful after a credential exists, but do not replace a stable, profile-first share surface. |

The API currently keys profile rows by `wallet_address`; its random profile ID
is stable only within that wallet-backed row. The public API removes private
publication fields but returns the selected credential summaries. Profile data
is authoritative application data requiring durable backups; chain-derived
credential projections remain rebuildable, and the registry plus
content-addressed metadata remain authoritative for proof. The new account
identity must preserve these boundaries and must not rewrite credential
ownership or conflate profile publication with proof verification.

## Target route and state contract

Keep public verification and public profiles available without sign-in. Use
account session state for profile editing. Use a separately associated wallet
only for credential lookup/selection. Keep organization issuance and its
transaction wallet session distinct from holder profile authentication.

| Route / state | Entry and action | Success contract | Loading, empty, and failure contract |
| --- | --- | --- | --- |
| `/` landing | Primary action is “Create your profile” → `/join`; secondary actions remain “View an example” (clearly illustrative) and “Verify a credential” → `/verify`. | The person reaches a Google sign-in entry before any wallet prompt. | No auth/wallet prompt on landing. Preserve the illustrative label on all synthetic examples. |
| `/join` | “Continue with Google” invokes Supabase Auth. Existing Google account returns to the same onboarding step; new account creates a private Credora account with stable internal ID. | Route to `/join/handle` with authenticated account session. Do not ask for a wallet. | Show disabled/pending provider action, provider unavailable, canceled sign-in, and retryable network failure distinctly. A canceled sign-in returns to the same join view without partial account creation. |
| `/join/handle` | Choose a normalized handle. Debounced availability feedback is advisory; “Claim handle” performs the authoritative atomic claim. | Persist one stable account-to-handle assignment; route to `/join/profile`. | Empty input → prompt; invalid syntax/reserved name → inline explanation; in-use race → keep input and suggest retry/edit; availability service failure → say status could not be checked and allow retry, never imply available. |
| `/join/profile` | Complete name, headline, about, photo URL, links, projects, experience, education. Save draft. Preview as a private profile. | Profile persists private by default under account ID; route to `/home` or profile preview with next-step action. The user can skip optional sections. | Show save pending/failed and retry without losing entered fields. Missing name/invalid URL is field-specific. Empty sections remain absent in preview. |
| `/home` (authenticated) | “My profile” and “My credentials” task cards. Profile card shows handle, private/public status, and completion prompts based on missing optional content. “Link a wallet to add credentials” is a separate action. | User can continue profile work without a wallet; wallet association is explicitly optional until credential access is requested. | Account loading, profile empty/draft, and account-service unavailable are different states. Do not show a wallet address as the primary account identity. |
| `/settings/wallets` or equivalent link step | Explain what wallet linking enables. Choose injected wallet; approve a one-time ownership signature. This step is only entered for credential lookup/selection. | Associate the verified address with the signed-in account; never transfer credential ownership. Return to `/credentials` and load that address’s confirmed credentials. | No provider, account rejection, signature rejection, API outage, invalid signature, already-linked address, or account mismatch each gets a recoverable and truthful message. No transaction or gas is required for association. |
| `/credentials` | Show achievements, issuer, date, and evidence. Select credentials for profile only after the wallet is linked. “View proof” opens the public verifier. | Confirmed credentials appear as proof summaries, with a separate independent-verification action. | Distinguish loading/service failure from a successful empty result. Empty copy says credentials are issued by organizations and offers “Link another wallet” / “How to receive a credential”; do not imply a user can mint their own. |
| `/profile/edit` and `/profile/preview` | Edit identity/profile fields and ordered content; explicit publication choice and explicit credential selection. Show exact preview and share URL before publishing. | Save privately or publish selected fields and references to `/u/{handle}`. | Handle collision/cooldown, unauthorized account, stale session, validation, and API failure remain distinct. Unsaved-change navigation asks before discarding. Publication requires explicit final action and names what becomes public. |
| `/u/{handle}` | Visitor opens a stable public URL without sign-in or wallet. Profile has share, QR, and credential links. | Render only published profile fields and selected credential references. Social metadata is generated from published fields only. | Initial load, not found/private/changed handle, and profile service unavailable are separate. A profile QR encodes this URL. Public-page sharing never implies proof validity or wallet control. |

The route names above are a target contract, not routes claimed to exist today.
Preserve `/verify` and `/verify/{credentialRef}` as public, walletless flows.
Existing `/profile`, `/wallet`, and `/u/{handle}` can be migrated or redirected
after the account and wallet association model is defined.

## API and persistence contract to implement

1. **Supabase Auth identity.** Verify Supabase access tokens server-side. Store
   the stable Supabase subject as the external identity key and assign a
   separate stable Credora account ID. Do not trust browser-provided account
   IDs or email claims without token verification. Define account deletion,
   recovery, email change, and Supabase outage behavior in the authentication
   ADR.
2. **Handle claim.** Add an availability read for normalized handles and an
   authenticated atomic claim operation. Availability response: `available`,
   `invalid`, `reserved`, or `taken`; include normalization rules. Claim
   response returns the canonical handle and public URL. The database unique
   constraint remains authoritative if a competing claim wins after the read.
   Existing 30-day handle cooldown and reserved-route policy need a migration
   decision before reusing them for account-owned handles.
3. **Profile operations.** Replace the profile's primary owner key from wallet
   address to Credora account ID. Keep profile fields, explicit publication,
   ordered credential references, and backup requirements consistent with
   ADR 0011. Draft/private records are readable only by the authenticated
   account; the public route resolves only `published = true`.
4. **Wallet association.** Add an account-to-wallet association table with
   unique normalized addresses and association status/timestamps. Challenge
   issuance and signature verification bind the address, nonce, expiry,
   application domain, and account session. Consume challenges once. Keep
   credential ownership on chain; linking only lets the signed-in account read
   confirmed records for that address. Do not make an issuer transaction or
   an account session bearer token serve as proof of wallet control.
5. **Credential projection.** Query only confirmed records for linked wallet
   addresses. Keep API/SQLite credential rows as rebuildable projections.
   Before adding a credential reference to a profile, check the confirmed
   recipient binding against an associated wallet. Verification still checks
   registry data and canonical metadata independently.
6. **Public share metadata.** Resolve the published profile on the server or
   loader that emits the HTML head. Set handle/name title, a bounded description,
   canonical URL, and an Open Graph/Twitter image generated only from published
   fields and selected credentials. Provide a neutral generic fallback for
   missing/unpublished profiles. Add a profile QR that points to `/u/{handle}`;
   keep credential QR codes pointed at verification routes.

Before migration, define how existing wallet-keyed profiles map to Supabase
accounts. Require proof from both identity systems for any automatic link;
never infer a Google account from a matching display name, email, credential,
or handle. Preserve unlinked legacy profiles privately until a verified owner
claims them, or specify a reviewed recovery path in the migration ADR.

## Implementation sequence

1. Accept ADRs for Supabase authentication/recovery, account-to-wallet linking,
   and profile privacy/source of truth. Include legacy profile migration and
   issuer-session separation.
2. Add server token verification, account ID persistence, account-scoped
   profile storage, and handle availability/atomic claim APIs. Keep the
   existing profile editor usable while the new APIs are introduced.
3. Build `/join` → `/join/handle` → `/join/profile` with private drafts,
   preserved form state, validation, and retry states. Update landing and
   public navigation CTAs to enter `/join`.
4. Add account home and optional wallet-link flow; make linked-wallet credential
   loading distinct from an empty library. Keep a wallet-free profile editor.
5. Add profile preview/publication confirmation and selected credentials.
   Preserve user-authored claims and issuer-backed evidence as separate
   sections and labels.
6. Add profile share URL, QR, and server-emitted social preview. Verify that a
   private or unpublished profile produces no identifying preview metadata.
7. Migrate existing sessions and profiles with explicit account ownership
   proof, then remove wallet-only profile gates. Keep issuer transaction
   authorization on its existing separate wallet session.

Use the existing Geist, chalk/white surfaces, iris accent, quiet borders,
12px control radii, and 16px card radii from [DESIGN.md](../../DESIGN.md). Keep
the first-run path task-focused: one step per screen, visible progress, direct
labels, optional profile sections clearly marked, no decorative eyebrows,
invented metrics, or explanatory hero copy inside the workflow.

## Acceptance tests

- Anonymous visitor can open `/`, `/verify`, `/verify/{reference}`, and a
  published `/u/{handle}` without Google sign-in or a wallet provider.
- Primary landing action opens Google sign-in. Successful new and returning
  sign-ins resume the correct onboarding stage; canceled/failed sign-in does
  not create a half-finished profile.
- Account creation, handle claim, and profile draft succeed without any wallet
  prompt or wallet provider installed.
- Handle input normalizes consistently; invalid, reserved, available, taken,
  concurrent-claim, and availability-service-error states are distinguishable.
- Profile drafts are private by default. Another account cannot read or edit
  them. Public lookup returns only selected published data.
- Wallet association requires a fresh, single-use signature challenge for the
  selected address and signed-in account. Cancellation, expiry, replay, wrong
  signer, duplicate association, and API outage fail safely and can be retried.
- Linking a wallet never changes chain ownership or starts an issuer
  transaction. Issuer issuance continues to require its own authorized wallet
  signature.
- Credential library renders a successful empty state separately from API,
  RPC, or projection failure. Credential selection rejects unconfirmed records
  and records not belonging to an associated wallet.
- Publication confirmation names the selected profile fields and credentials,
  explains the identity-to-public-wallet-record association, and distinguishes
  public proof from profile claim and wallet-control assurance.
- Public profile QR opens `/u/{handle}`; each credential action opens its
  independent verifier. Profile share previews use published fields only;
  private profiles produce no identifying social metadata.
- Handle change, unpublish, profile not found, malformed handle, and profile
  service outage produce their distinct expected responses and user-facing
  recovery actions.
- Keyboard-only path covers Google action, handle field/status, profile fields,
  wallet-link action, publication choice, share/QR actions, and error recovery.
  Reduced-motion settings do not block onboarding. These are acceptance
  criteria to verify during implementation; no accessibility measurements are
  claimed by this audit.
