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

## Tokens and composition

The light canvas is `#fafafa` with white surfaces, `#171717` ink and `#e5e5e5` dividers. Dark mode uses `#171717` canvas, `#202020` surfaces and `#f5f5f5` ink. The semantic tokens in `globals.css` own success, warning, error and focus colors for both themes. Controls use an 8px base radius and larger panels use 16px; avoid nested panels when a divider conveys the same structure.

The landing signature is an editorial split: an oversized serif claim and primary profile action beside a labeled profile-and-proof illustration. On smaller screens the claim precedes the illustration. The illustration uses real component structure and synthetic, explicitly labeled content, not a screenshot or a claim of live verification. Product workspaces use Geist, a persistent desktop navigation and a labeled mobile menu. Constrain reading widths, use a predictable 4/8/16/24/48px spacing rhythm, and allow headings and references to wrap.

Use one coherent line-icon grammar and text labels for meaningful actions. Photos are user supplied, never assumed to prove identity; provide initials or text when absent. The hero is the only place for a substantial atmospheric surface. Actions have visible focus and short state feedback; respect reduced motion and retain a static credential presentation. Empty, loading, error, unavailable and success states name what happened and the next available action. Do not imply a failed network request is an empty library or invalid proof.
