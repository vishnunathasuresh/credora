# Credora design system

## Direction

The user rejected the sparse serif folio. Replace it throughout with a
professional network and restrained workspaces, as explicitly selected on
2026-10-29. Product behavior remains defined by docs/roadmap/product-direction.md.

## Visual system

Geist variable sans, locally served. Chalk canvas, white surfaces, near-black
ink, violet/iris brand accent and pale lavender product stages. Meaningful
verification results retain separate semantic success/warning/error colors.
No serif hero, eyebrow labels, fake counts, customer logos or invented activity.
Use 12px control radii, 16px feature surfaces, hairline borders and soft elevation
only for floating physical objects or overlays. Normal controls are at least44px.

## Public landing

A complete product story, not a heading and disconnected badge. First viewport:
compact navigation, strong two-line identity headline, direct profile and verify
actions, and a large composed product preview showing the relationship between
person, handle, organization and credential. Mark previews illustrative at their
boundary. Subsequent sections show a profile canvas, physical credential, sharing
and organization workflow with distinct compositions, then a real closing CTA.
Only link to available routes; never advertise networking as shipped.

Use the actual React Bits lanyard (Three.js with upstream rope physics), customized with
credential and organization data, on full verified detail and an explicitly
illustrative homepage preview. Lazy-load it behind an interactive static facade.
Retain HTML details, keyboard flip, static reduced-motion/no-WebGL fallback.

## Inner pages

A persistent compact sidebar on desktop and accessible mobile navigation.
Profile, credentials, verification and workspaces are distinct destinations.
Route titles, content widths, action bars, connection gates, empty/error/loading
states, forms and tables share one visual grammar. Public profiles are expressive
person-first pages; editing and issuer/admin workspaces are calm and task-focused.
Remove repeated system explanations and eyebrow labels. Keep necessary safety,
privacy and failure-state copy.

## Delivery and evidence

Preserve the working TanStack Start port and API/proof boundaries while replacing
all rejected visual material. Root owns integration and PR; Luna High owns scoped
UI work. Read-only testing can use Antigravity High. Verify desktop/mobile captures
and route content, not only HTTP status. Record implementation and honest limits
in docs/ux/tanstack-redesign-plan.md after the redesign passes review.
