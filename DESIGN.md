# Credora design system

Credora uses a professional network language for public identity and restrained
workspaces for editing and issuing. Product scope lives in
[the product direction](docs/roadmap/product-direction.md); implementation and
verification evidence live in [the redesign record](docs/ux/tanstack-redesign-plan.md).

## Visual language

Geist Variable is served locally. Chalk backgrounds, white surfaces, near-black
text and iris purple establish the light theme; dark mode remaps those semantic
roles to charcoal and pale iris. Ordinary supporting text uses a readable muted
ink, including placeholders. Verification success, warnings and errors have their
own colors and explicit text; brand decoration never asserts proof validity.

The implementation tokens are in `apps/web/src/styles/globals.css`. Use them
instead of introducing competing palettes. Controls have 12px radii, ordinary
surfaces 16px radii, quiet borders and a consistent spacing scale. Soft elevation
belongs to floating credential objects and overlays. Headings use sans-serif
weight and scale; avoid decorative eyebrows, invented metrics and fake activity.

## Navigation and layout

The landing page combines a person, handle, issuer and achievement in a composed,
explicitly illustrative preview. Profile, credential and sharing sections use
different compositions, followed by a working profile action. Marketing copy
must describe implemented capabilities.

Public profiles, verification and temporary shares use the public header without
a workspace sidebar. Private profile, credential and role workspaces have a
compact desktop sidebar. Role-specific destinations remain behind the workspace
entry. Mobile navigation uses a named Radix dialog with focus management.

Content is fluid, with a 1200px general measure and narrower public profiles.
Narrow layouts become one column, identifiers wrap, and controls have at least
44px touch targets. Keep loading, empty, unauthorized and infrastructure-error
states distinct. Root errors and missing pages provide recovery actions.

## Profiles

Public identity leads with the photo or initials, name, handle and headline.
About, links, experience, education and projects follow as user-written content.
Issuer-backed credentials are a separate section; summaries are display
projections and their links open independent verification.

The editor groups identity, projects, experience, education, featured credentials
and publication. Stable entry IDs preserve ordering. Use explicit up/down controls
for accessible ordering. Photos currently use HTTPS URLs with a local initials
fallback; this is not a file-upload service. Profiles stay private until published.

## Credentials and motion

The selected React Bits lanyard uses its upstream Three.js physics implementation.
Organization, title, recipient and date are rendered onto locally generated card
textures. Attribution and license are retained under `apps/web/public/lanyard`.

Load the renderer only after interaction. Keep HTML credential information and
working front/details controls available for reduced motion and renderer failure.
Bound pixel density, pause offscreen/background animation and dispose resources
on unmount. A full credential's interactive presentation requires a matching
proof; landing demonstrations stay explicitly illustrative.

## Components and review boundaries

Compose the existing shadcn/Radix controls with Hugeicons. Tailwind utilities,
semantic token mappings, keyboard focus, labels and validation states are part
of the component foundation. Keep native checkbox sizing separate from text
inputs. Reference sources are recorded in
[component sources](docs/ux/component-sources.md).

The detector's single Geist warning was accepted as a low-severity choice for
readable workspaces. The independent review accepted the replacement layouts;
its final verdict marked the reported profile, contrast and capture fixes
resolved. This is not whole-app WCAG certification or live-chain browser proof.
See the redesign record for tested states and remaining boundaries.
