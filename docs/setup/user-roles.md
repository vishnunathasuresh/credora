# Set up by user role

Anyone can verify a public credential without connecting a wallet. Wallet
connection is needed for account-specific holder, issuer, organization, and
administrative tools. A wallet address is public; its recovery phrase and
private key must never be entered into Credora or shared with an issuer.

## Verifier

1. Open `/verify` on the web app.
2. Scan the credential QR with the camera or upload a QR image. A public verification link or
   credential hash is also accepted as a fallback.
3. Review whether the proof is valid, missing, malformed, or unavailable.

An RPC or metadata outage is reported as unavailable; it is not evidence that
a credential is invalid.

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

Organization issuers are authorized by their own organization's administrators
on the organization registry. Platform approval is required once for the
organization; it is not required for individual credentials.

1. Ask an organization administrator to add your public wallet in `/org`.
2. Switch your wallet to Credora's configured chain and RPC.
3. Open the organization's `/org` workspace, connect the authorized wallet,
   enter the learner address and credential details, then confirm the wallet
   transaction.
4. Optionally attach a public certificate image and share its verification QR
   or link with the learner.

Legacy v1 issuer access is global to the v1 registry and remains managed by its
registry administrator from `/superadmin`. It does not grant issuer authority
for any organization-bound v3 credential.

Credential metadata and attached images are public when stored on IPFS. Keep
unnecessary personal information out of their contents. Issued v1 credentials cannot be edited; an
incorrect issuance needs a future append-only status/revocation process.

## Organization applicant and administrator

1. Open `/org`, connect the wallet that will own the organization, and submit
   its legal name, registration reference, HTTPS evidence, and official site.
2. A Credora superadmin reviews the evidence in `/superadmin`. Approval is
   completed by an on-chain activation transaction.
3. The applicant wallet becomes the initial organization admin and issuer in
   that transaction. It can issue immediately after activation is confirmed.
4. In `/org`, administrators can add or remove issuer and admin wallets,
   publish versioned templates, and configure optional internal review.
5. Authorized organization wallets issue singly or in batches. If internal
   review is enabled, a separate designated reviewer must approve a prepared
   issuance before it can be signed on-chain.

Credora superadmins can suspend or restore an organization on-chain. Suspension
blocks new issuance by all organization wallets; already-issued proofs remain
verifiable. Organization state shown by the API is a projection of registry
state.

## Superadmin

A superadmin reviews organization applications and manages exceptional
organization suspension.
The connected address must have the required superadmin access. The registry
is authoritative for chain-level roles and issuer authorization; any
`API_SUPERADMIN_ADDRESSES` or legacy `API_ADMIN_ADDRESSES` setting is a
server-side bootstrap override and must only contain trusted addresses.

Open `/superadmin` with the configured wallet and independently verify each
organization and applicant before on-chain activation. Never put an
administrator private key in an API or browser environment variable.
