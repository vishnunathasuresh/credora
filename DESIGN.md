# Credora visual direction

## World

Credora should feel like a clear public protocol interface: quiet, precise, and inspectable. The landing page uses a shadcn-style neutral system rather than a decorative editorial treatment.

## Palette

Neutral background and foreground tokens carry the page. Borders, muted text, and surfaces use the neutral scale. Semantic green is reserved for verified or healthy states; it is not a general brand accent.

## Typography

Use a modern system sans for interface copy and a restrained, tightly tracked display scale for the hero. Monospace is reserved for hashes, IDs, and protocol values.

## Surfaces

Use a small number of calm bordered surfaces with 12px radii, one soft elevation level, and clear grouping. Avoid decorative gradients, fake metrics, and unearned customer proof.

Workspace screens use the same surfaces as the public verifier: a strong page heading, one clear primary action, compact status pills, readable forms, and projection views that visibly remain projections. Role-specific actions should stay distinct without creating a new visual language.

## Landing page intent

The first viewport should make three things obvious within seconds: what Credora is, why the proof is durable, and where a visitor can verify a credential. The proof-path interaction remains the explanatory centerpiece and must retain its illustrative-only label.

## Components

Web controls use the checked-in shadcn components in `apps/web/src/components/ui`: Button, Input, Textarea, NativeSelect, Label, Card, Badge, and Dialog. Extend these primitives instead of introducing a second control system. Use Hugeicons stroke-rounded glyphs through the local icon wrapper, including icons inside shadcn primitives. Keep action links as links through Button's `asChild` support. Use the primary button for the main task, outline for secondary actions, ghost for navigation, and destructive styling for destructive actions. Preserve visible focus, disabled, loading, and error states.

Radix-backed Dialog owns web QR sharing and narrow-screen navigation, including a named title, description, close action, and focus management. QR sharing exposes the public verification URL alongside the code; copy/share failures retain an actionable fallback. QR download is an image of the public link, not a credential document or independent proof.

Organization enrollment starts from `/org` after wallet authentication. A request remains pending until a superadmin independently reviews the applicant wallet and self-reported website. The applicant's downloadable QR contains only an opaque protected review reference. Scanning opens the pending request in the superadmin workspace; it cannot approve, register, or authorize by itself. Keep review, issuer authorization and registry availability as distinct states. Organization access remains an API record, while the credential registry separately decides whether its wallet may issue.

First-time wallet guidance explains account creation, recovery-phrase privacy, sharing the public address with an issuer, and signing the web login message. Keep this help beside the holder journey. Public verification remains available without a wallet. Distinguish wallet connection, signed login, and issuance transactions; signing in does not cost gas.

Verification feedback names the failed dependency or proof condition, then offers a relevant next action. Keep malformed references, absent records, ledger outages, unavailable metadata, inconsistent metadata, and service outages distinct. An unavailable service must not appear as an invalid credential. Loading, empty collections, local storage failures, and sharing failures need explicit copy rather than blank surfaces.

Native screens inherit this identity through Tamagui rather than web primitives. Platform context lives in `apps/mobile/PRODUCT.md` and `apps/mobile/DESIGN.md`: the native app carries locally saved public links and verifies through the configured service; wallet signing stays on the web.
