# Credora design direction

Credora presents professional identity as an open editorial spread, with credentials treated as
evidence that can be checked independently. The visual system follows OpenSource UI's quiet neutral
stage, clear type, hairline separators, and restrained semantic color, adapted to Credora's neutral paper and graphite ink. Product and protocol truth remain in [PRODUCT.md](PRODUCT.md)
and the [agreed product direction](docs/roadmap/product-direction.md).

## Visual system

- **Palette:** white and near-white paper (`#ffffff`, `#fafafa`), graphite ink (`#171717`),
  neutral rules (`#e5e5e5`), and charcoal (`#262626`) for primary actions. Dark mode uses neutral
  charcoal surfaces. Green is reserved for proof and success states. Success, unavailable, warning, and error states use distinct semantic colors and explicit
  labels. Purple is not part of the interface palette.
- **Type:** locally served Instrument Serif for marketing display headings and Geist Variable for UI.
  Public display headings carry the editorial scale through size, measure, and deliberate line breaks; operational headings
  stay compact. Supporting copy remains readable and direct.
- **Surfaces:** flat neutral-paper fields and quiet hairline separators. Use filled panels only when
  they group a real task or a credential object. Avoid decorative gradients, glow, dot fields,
  invented metrics, and generic icon tiles.
- **Controls:** follow the OpenSource UI component language and keep Credora's Radix primitives and
  Hugeicons. Controls retain visible focus, accessible labels, clear disabled/pending states, and
  touch targets of at least 44px where practical.

## Public pages

The landing page leads with an open two-column identity-and-credential spread, explicitly marked
illustrative. The profile and credential belong together; avoid stacked decorative card frames,
repeated sample cards, and fictitious public organization pages. Following sections explain the
distinction between user-written profile claims and issuer-backed evidence, independent
verification, and the available sharing choices. Keep the primary path to profile creation distinct
from the visitor path to verification.

Public profile pages lead with the person's selected identity, then user-authored sections, then
featured credential summaries. A summary is not a verification result. Credential detail and
temporary-share pages retain the actual proof status and source failure states. Social previews are
generated from the same public profile data. Profile details that have been added publish together;
credential featuring is selected independently. Copy must not suggest field-by-field privacy controls.

## Operational pages

Workspaces use the compact sidebar shell on desktop and the workspace menu on narrow screens.
Forms, libraries, issuer operations, organization applications, and administration use page-specific
layouts around their primary task. Keep issuer, wallet, account, review, and verification sessions
distinct. Evidence fields and actions must scan clearly without suggesting that a record is verified
until the proof flow says so.

## Product truth and interface states

Profiles start private and remain usable before wallet linking. Publication is explicit and names
what becomes public. Temporary selected-credential shares remain distinct from public profiles.
On-chain records are authoritative for issued proof; API projections and workspaces do not replace
independent verification. Never imply that profile content proves wallet control or changes an
issued credential.

Preserve distinct checking, verified, absent, malformed, mismatch, metadata-unavailable,
ledger-unavailable, service-error, signed-out, loading, empty, and retry states. Infrastructure
failure never becomes an invalid-proof result. Example identity and achievement details are marked
illustrative; there is no seeded live credential catalog.

## Responsive behavior and review

Public compositions have generous desktop rhythm and move into a readable single-column sequence on
mobile. Operational screens keep controls and evidence legible without shrinking a desktop grid;
tables may scroll horizontally when necessary. Check the landing page, profile editor, credential
library, verification entry/result, issuer workspace, and share route at desktop, tablet, and mobile
widths. Captures prove the local UI composition only; they do not prove live OAuth, chain, gateway,
camera, or wallet behavior.

## OpenSource UI source adaptations

The credential/profile share flows use an adapted Copy to Clipboard component, and the landing
identity preview uses an adapted Editorial Staff Profile row. Both preserve Credora's route data,
fallback behavior, accessibility semantics, and illustrative labeling. Their MIT attribution and
permission notice are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
