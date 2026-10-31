# Opensource UI redesign review

Review of the identity-first web UI, 2026-10-31. This is a scoped design and
technical review, not a WCAG certification or evidence of a production
transaction. Product and proof boundaries remain in
[product direction](../roadmap/product-direction.md) and [DESIGN.md](../../DESIGN.md).

## Independent critique

Two independent Terra assessments reviewed the design and technical evidence.
The design assessment inspected desktop and mobile landing pages and the mobile
verification form. It found the identity-first claim, privacy reassurance and
explicitly illustrative data effective. Its provisional heuristic score was
25/36 for those surfaces only; it did not inspect authenticated screens or score
error recovery. It identified a weak mobile connection between profile and
proof, an underused desktop profile preview, and insufficient guidance on the
format of a credential reference. The landing illustration now includes an
illustrative issuer-to-public-check path, including a compact mobile treatment,
and the verification form describes the accepted hash format.

The independent technical assessment ran the Impeccable detector on
`apps/web/src/components`: it returned no findings. It identified a visually
hidden upload input that remained a duplicate keyboard stop. The input is now
hidden from navigation while the visible upload action opens its file picker.
The collaborative browser's evaluation API was read-only, so its detector
injection and overlay were not available; no overlay result is claimed.

## Browser evidence

The implementation pass used an isolated desktop and synthetic local fixtures.
At 1440px, 768px and 390px, 11 public or signed-out routes rendered without
horizontal overflow or browser page errors. Mobile navigation, an invalid
reference, the QR upload picker, a public profile share dialog and Escape close
were exercised. The issuer, organization and administrator workspaces were
rendered at desktop and mobile sizes with synthetic role and API responses;
the organization review queue was also tested with a temporary failure and
retry. A synthetic account fixture exercised profile publication and preview,
credential selection and temporary-share QR creation. The reduced-motion
credential reverse QR was decoded to the expected synthetic verification URL,
and the interactive canvas and static information view rendered in the isolated
browser.

Automated axe-core WCAG A/AA scans on the tested public, signed-out and
synthetic signed-in surfaces were rerun after fixing label and contrast issues.
They reported no remaining violations on those states. These checks do not
replace keyboard, assistive-technology, device or security testing.

## Remaining evidence limits

The synthetic browser fixtures do not validate live Google OAuth, production
API availability, wallet signatures, on-chain transactions, physical camera
scans, social crawlers or deployment. The interactive QR texture was visually
observed but not physically scanned. Vite reports a large client chunk. The
independent design critique was limited to the public landing and verification
surfaces; the other screen checks above were implementation-side inspections.
