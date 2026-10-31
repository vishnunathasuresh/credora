# Credora design direction

Credora presents a person's work first, with independently checkable evidence close at hand. The [product direction](docs/roadmap/product-direction.md) owns journeys and feature availability; this document describes the interface.

## Visual system

Paper and ink, fine dividers, deliberate spacing and restrained elevation make the work and its evidence the focus. Instrument Serif is reserved for expressive display moments; Geist carries body text, navigation and controls. Use monospace for actual proof references and technical data. Navigation and forms stay quiet; a hero may use a focused background treatment. The existing icon family and text labels carry actions. Visible keyboard focus, readable contrast and reduced-motion alternatives are required.

The landing page pairs a direct claim with an explicitly illustrative profile and credential. Preserve the distinction between a person's own words and an issuer's record. Never invent users, endorsements, counts or verification results. Avoid unrelated photography and decorative effects. Use real screenshots or properly licensed assets only where they improve understanding.

## Navigation and journeys

- The public shell leads to profile creation, credentials and verification; verification requires no account or wallet.
- Workspace home puts profile and credentials first. Organization tools are a separate, wallet-authorized task.
- `/credentials` is the primary library URL; `/wallet` remains available for existing links. `/settings/wallets` manages linked wallets.
- Profile editing and publication are separate from the public `/u/:handle` view. Profiles start private and publication is explicit.
- Verification and sharing must preserve distinct checking, unavailable, absent, malformed and mismatch outcomes. Never imply an unavailable service makes a proof invalid.

## Component decisions

The shared shell, workspace overview, credential presentations and proof states are custom compositions. Local button, input and dialog primitives are adapted for the product; their use does not make shadcn a design requirement. The profile identity and copy interaction adapt Opensource UI components; source and license details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The [Opensource UI catalog](https://opensourceui.in/components) is the component reference, while its [source](https://github.com/bidyut10/opensourceui) is authoritative for implementations and licensing.

## Boundaries

Registry proof remains authoritative. A profile claim, an issuer-backed achievement and control of a wallet are separate assurances. Publication cannot recall copies or remove public proof. Keep issuer confirmation bound to the exact recipient address and retain existing authorization, privacy and infrastructure-failure behavior when changing presentation.
