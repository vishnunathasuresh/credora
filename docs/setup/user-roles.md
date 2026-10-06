# Set up by user role

Anyone can verify a public credential without connecting a wallet. Wallet
connection is needed for account-specific holder, issuer, organization, and
administrative tools. A wallet address is public; its recovery phrase and
private key must never be entered into Credora or shared with an issuer.

## Verifier

1. Open `/verify` on the web app, or select Verify in the mobile app.
2. Paste a public verification link or credential hash, or scan its QR code.
3. Review whether the proof is valid, missing, malformed, or unavailable.

An RPC or metadata outage is reported as unavailable; it is not evidence that
a credential is invalid. `/demo` records are synthetic examples, not verifiable
issued credentials.

## Credential holder

1. Create or use an Ethereum-compatible wallet from its official provider and
   keep its recovery phrase private. For example, see [MetaMask's download
   page](https://metamask.io/download/) and [wallet creation
   guide](https://support.metamask.io/start/creating-a-new-wallet).
2. Give the issuer your public wallet address before issuance.
3. Open `/wallet` in the web app, connect the wallet, and sign the login
   challenge. This login signature is not a transaction and costs no gas.
4. After an issuer confirms issuance, open the credential and share its
   verification link or QR. A selected-credential QR can group public hashes
   for a limited time; recipients still verify each proof against its sources.

## Issuer

An issuer needs a wallet authorized by the registry's superadmin. Organization
membership or API login alone does not grant on-chain issuance authority.

1. Ask the superadmin to authorize your public address on the configured
   registry.
2. Switch your wallet to Credora's configured chain and RPC.
3. Open `/issuer`, connect the authorized wallet, enter the learner address
   and credential details, review them, then confirm the wallet transaction.
4. Share the resulting public verification link with the learner.

Credential metadata is public when stored on IPFS. Keep unnecessary personal
information out of its contents. Issued v1 credentials cannot be edited; an
incorrect issuance needs a future append-only status/revocation process.

## Organization applicant and administrator

1. Open `/org`, connect a wallet, and submit the organization name and its
   HTTPS website.
2. A superadmin independently reviews the organization and applicant wallet
   from `/superadmin`, then approves or rejects the request.
3. After approval, use `/org` to manage the organization workflow.
4. If the same wallet must issue credentials, ask a superadmin to authorize it
   separately as an on-chain issuer.

Credora v1 grants organization administration to one wallet per organization;
it does not yet invite a team. Suspending organization access blocks subsequent
API operations but does not revoke an existing on-chain issuer authorization.

## Superadmin

A superadmin reviews organization requests and manages issuer authorization.
The connected address must have the required superadmin access. The registry
is authoritative for chain-level roles and issuer authorization; any
`API_SUPERADMIN_ADDRESSES` or legacy `API_ADMIN_ADDRESSES` setting is a
server-side bootstrap override and must only contain trusted addresses.

Open `/superadmin` with the configured wallet, check each organization and
wallet independently, and authorize issuer addresses only after review. Never
put an administrator private key in an API or browser environment variable.
