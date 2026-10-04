# Credora mobile

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Credora mobile helps holders carry public credential links and helps verifiers check their public records. It inherits the product and protocol rules in the root `PRODUCT.md` and `AGENTS.md`; this file describes the native surface. The first-time user may have neither a wallet nor a saved credential.

The app is a local public-link library, not an embedded signing wallet. It stores credential hashes, display names, save times, and server settings in device storage. It contains no synthetic seed credentials. The blockchain registry remains authoritative; saved links and API results do not replace the public proof.

## Primary tasks

- **Credentials:** begin with a truthful empty library, add a link after a successful check, show verified details in a credential card, share the credential QR image, create one expiring QR image for selected credentials, check again, or remove a local link. Removing a link does not change the immutable issued credential. The library holds up to 100 links and a share can contain up to 25.
- **Verify:** paste a public `/verify/` link or hash, or scan a credential or selected-share QR. Verification uses the configured API and needs a connection. Scanning extracts a credential reference or an allowed share token and does not automatically open an arbitrary scanned website. A matching proof does not establish that the presenter controls the holder wallet.
- **Setup:** explain verification without a wallet, official wallet installation, private backup information, sharing a public address with the issuer, and web wallet sign-in. Expose the API and public website addresses for local or deployed services; these select the service and registry the user trusts.

Wallet-based discovery happens on the web: open the holder wallet in a compatible wallet browser, connect, sign the login message, and copy public credential links into the native library. Login signing costs no gas. Credora never asks for a recovery phrase or private key.

After successful service-backed verification, Download prepares a public JSON copy containing the hash, verification URL, public metadata, and check time. Native export uses the device share sheet. It is not an offline proof, a new credential, or the original attachment download. Recipients must verify the current public record again.

## Recovery and scope

Name malformed input, absent records, ledger unavailability, metadata unavailability, mismatched proof, and service unavailability separately. An outage does not mark a credential invalid. Camera denial offers pasted input; export and sharing failures offer the public link or QR. If saved data cannot load, pause library writes and removals and keep verification available. Storage and settings failures explain how to retry.

Scope is phone-first holder and verifier work on iOS and Android, with a web preview for development. Issuance and administration remain web tasks. Safe areas, keyboard handling, Android back navigation, system appearance, accessible labels, and device sharing belong to this native surface.

Native bundles have succeeded. Device/emulator runtime captures, VoiceOver/TalkBack behavior, camera permission/scanning, and native file/link sharing still require validation; bundle success is not evidence of those behaviors.
