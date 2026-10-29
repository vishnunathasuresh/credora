# Credora design system

Status: replacement design contract for the TanStack Start port. Implementation
and final browser evidence are tracked in docs/ux/tanstack-redesign-plan.md.

## Identity

A professional folio centered on people and earned achievements. Warm white,
ink, and cobalt; careful typography, hairline divisions, generous space, and a
physical credential as the signature object. The product roadmap lives in
[product direction](docs/roadmap/product-direction.md).

## Structure

The public homepage introduces a shareable professional identity. Verification
has a dedicated direct entry. Workspaces prioritize credential content and
profile actions. Organization and achievement details are on the credential
card. Keep self-written claims, reviewed organizations, and matching proof
visually and semantically distinct.

## Components

Compose existing shadcn/Radix controls and Hugeicons. Use semantic tokens,
visible focus, 44px touch actions, clear form labels, compact useful copy, and
explicit loading/empty/error states. No eyebrow labels or implementation
explanations in normal product flows. No invented metrics or customer claims.

## Responsive and motion

Mobile-first fluid grids and component containment. Single-column narrow
layouts, accessible navigation sheet, and wrapping long values. The lanyard
is lazy and interactive; reduced-motion and unsupported browsers retain an
accessible static badge with explicit flip control. Motion never asserts proof.

## Evidence

Replace provisional token/layout descriptions with verified built behavior at
finish. Do not equate intended design with completed functionality.
