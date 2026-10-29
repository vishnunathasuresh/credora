# ADR 0011: Profile identity and publication

Status: accepted

## Context

A public profile is user-authored application data and cannot be reconstructed from credential events. ADR 0006's projection boundary applies to chain-derived credential data, not to profiles. This increment uses existing wallet sessions; independent accounts, wallet linking, and recovery require separate decisions.

## Decision

- Profiles have random stable IDs and one normalized, unique handle. A wallet session controls the profile associated with that wallet; this is transitional and does not transfer credential ownership.
- Profiles start private. The owner explicitly publishes profile fields and an ordered selection of credential references. A selection is accepted only for confirmed credential projections whose recipient is the authenticated wallet. Each reference still requires independent proof verification.
- Profile content may include an optional HTTPS avatar URL and ordered education, experience, and project entries. These are user-authored application data stored durably with the profile; list order is preserved and each entry has a stable per-list ID. Avatar URLs are rendered by clients only: the API never fetches them. Project links may be HTTP or HTTPS URLs. These fields remain subject to the same explicit profile publication gate.
- Handles use lowercase ASCII letters, numbers, and underscores, 3–30 characters, with route and administrative names reserved. A change has a 30-day cooldown; the old URL immediately stops resolving and the old handle becomes available. Handle reuse does not transfer profile identity or credentials. Broader impersonation handling and moderation are prerequisites to discovery.
- Profile content, handle assignments, publication and selections are authoritative application data. Back up and restore the database durably; rebuilding chain projections cannot restore them. Chain and content-addressed metadata remain authoritative for credential proofs.
- A credential may display the published name and handle only while that profile explicitly selects the reference and a confirmed projection still identifies its wallet as recipient. This decoration is not proof of identity or wallet control.
- Unpublishing prevents future profile lookup; it cannot recall copies or remove public ledger records. No public profile response contains session tokens or private settings.
- Rich profile fields are application data only. They do not alter credential metadata, hashes, on-chain issuance, or wallet ownership. Existing clients that omit these fields when updating a profile preserve their stored values.

## Consequences and compatibility

Existing wallet sessions authenticate profile operations without promising pre-wallet signup, account recovery, or wallet reassignment. Database loss can lose profile data. Public identity may associate a person with public credential and wallet records. Existing temporary shares remain separate. Publishing a selection is not a proof check or a claim of current wallet control by a visitor.
