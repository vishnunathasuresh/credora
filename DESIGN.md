# Credora design direction

Credora presents a person's work first, with independently checkable evidence close at hand. The agreed [product direction](docs/roadmap/product-direction.md) defines the journeys and delivery order; this document describes their visual expression, not feature availability.

## System

Use a quiet paper-and-ink foundation, fine dividers and generous spacing. Instrument Serif carries expressive display moments; Geist is the functional face, with monospace reserved for proof references. Navigation and forms remain calm and legible; reserve a focused background treatment for a marketing hero, never for every application panel. Use the existing icon family consistently and keep text labels for consequential actions. Focus indicators must remain visible and motion must respect reduced-motion preferences.

The landing page should pair a direct statement with an authentic credential or profile view. A split editorial composition is preferred to a centered stack of decorative cards: it gives proof a meaningful place without implying demo data is live. Do not invent issuer endorsements, user counts, or verification results. Avoid placeholder photography and unnecessary visual effects.

## Component decisions and references

- Shared navigation: **custom**, using existing routes and dialog behavior; the initial milestone refines the shell without replacing page workflows.
- Buttons, inputs and dialogs: **adapt existing local primitives**; review each against actual states before changing it.
- Hero background and product presentation: **future custom composition**, informed by the [component catalog](https://opensourceui.in/components) and [Opensource UI](https://opensourceui.in/); no upstream component copied in this milestone. Study the [upstream source](https://github.com/bidyut10/opensourceui) and its license before copying any component.

## Route milestones

1. Shared public and workspace shell, preserving existing routes and states.
2. Identity and profile creation, editor, public profile and wallet settings.
3. Credential library, detail, verification and sharing, including distinct proof and infrastructure states.
4. Organization and issuer workspaces, retaining explicit recipient confirmation and signing behavior.
5. Administrative and remaining public routes, followed by a cross-route accessibility and responsive review.

Apply the product direction's delivery gates independently of this visual sequence. Published identity is opt-in; self-authored claims, issuer-backed evidence and wallet control remain distinct. Registry proof is authoritative, and projections do not become proof through presentation.
