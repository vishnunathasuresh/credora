# Credora UI/UX audit

Historical review of the earlier interface. The current visual direction and
component choices are in [DESIGN.md](../../DESIGN.md) and
[component sources](component-sources.md); references below to Next.js and
the former design tooling describe the audited version, not the current app.

Audited 4 October 2026 using Impeccable, Credora protocol guidance, source review,
a production web build and browser interaction checks.

## Implementation integrity

The web uses shadcn Button, Input, Label, Textarea, NativeSelect, Card and
Dialog primitives. Semantic page structure, neutral styling and the proof
visualization remain product-specific. Shared reference parsing lives in
`packages/shared`; protocol normalization stays in `credential-core`. The API
remains a convenience projection/service, and the registry plus metadata remain
authoritative.

## Web health score

These are bounded audit judgments, not WCAG certification or performance benchmarks.

| Dimension                | Score            | Evidence and limit                                                                                                                                      |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 3/4              | shadcn focus-managed dialogs, labelled forms, skip link and 44px targets; full screen-reader and authenticated-form traversal pending                   |
| Performance              | 3/4              | Next production build passed; no unbounded animations found; no field performance/Lighthouse measurement                                                |
| Responsive design        | 3/4              | ten routes at 1280px and 390px; no document overflow or visible undersized buttons in checked states; zoom/tablet/protected forms need broader coverage |
| Theming                  | 3/4              | neutral tokens and both appearances; body and primary CTA contrast 18.97:1, muted copy 6.95:1 light / 7.66:1 dark                                       |
| Implementation integrity | 3/4              | actual shadcn components and truthful projection states; accumulated legacy CSS still coexists with Tailwind                                            |
| Total                    | **15/20 — Good** | applies to the inspected web scope                                                                                                                      |

Contrast ratios were measured from the rendered root palette and homepage CTA;
these measurements do not establish contrast for every semantic badge or nested surface.

## Scope and checks

Source reviewed across landing/proof walkthrough, public verification and result
states, synthetic catalog, role selector, issuer, organization, holder, admin,
superadmin, theme switching and credential sharing. Browser captures covered
`/`, `/verify`, `/demo`, `/dashboard`, `/wallet`, `/issuer`, `/org`, `/admin`,
`/superadmin`, and `/verify/invalid` at desktop and phone widths. These route
captures show top viewports and disconnected workspaces; they are not evidence
of authenticated issuance or live blockchain transactions.

The independent finish reviewer requested fixes for CTA readability, false-empty
wallet state, documentation, and current verifier captures. The fixes were
applied as one batch. Holder loading was checked with an invalid synthetic cached session: service failure showed an unavailable/retry
state, with no “No confirmed credentials found” claim. The temporary session
was removed.

Passed: workspace typecheck/tests, web production build, and browser interaction
checks. The web Impeccable detector returned no findings.

## Findings addressed

| Priority | Finding / location                      | User impact                                                            | Resolution                                                                                                |
| -------- | --------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| P1       | Custom controls throughout web          | Component drift; sharing modal lacked reliable focus/keyboard handling | Real shadcn controls and Radix Dialog focus management, Escape and focus return                           |
| P1       | Wallet connect screens                  | New users had no route from unfamiliar wallet terminology to sign-in   | Shared three-step guide: official wallet setup, public address, signed message; explains no gas for login |
| P1       | Homepage CTA after component migration  | Primary link text had the same foreground/background                   | Explicit shadcn primary-anchor foreground; measured both themes                                           |
| P1       | Holder restored-session request failure | API outage could look like a confirmed empty library                   | Loading/unavailable/retry state; empty only after a successful list response                              |
| P2       | Form placeholders, focus and targets    | Low-contrast placeholders and compact actions impeded interaction      | Token-based placeholder text, focus coverage and 44px target minimums                                     |
| P2       | Hash-only web reference entry           | Public links required manual hash extraction                           | Link-or-hash parser; invalid QR URLs are never automatically followed                                     |

## Organization enrollment update

The `/org` request path now requires an authenticated wallet, an organization
name, and a self-reported HTTPS website. It creates only a pending application.
The applicant QR opens its opaque request reference in the protected
superadmin review queue; it contains no name, wallet address, approval secret,
or capability. The reviewer sees the submitted wallet and website and is told
to verify both through an independent source. The queue is rate-limited and
bounded. Approval, rejection, suspension, and reactivation require the
superadmin API role.

The web production build and API TypeScript build pass, and the SQLite
organization migration starts successfully against an in-memory database.
T3 preview confirmed the disconnected `/org` route at 390px and 1280px without
document overflow. It did not exercise a signed application, scanned QR,
superadmin decision, or registry-backed issuance. The existing 15/20 UI score
is the baseline audit score; this workflow has no authenticated visual or
end-to-end score yet.

## Selected wallet QR and credential cards

The holder can now pick up to 25 public credentials and publish one expiring
share QR for the fixed selection. Expiry options are 1, 7, or 30 days. The
receiver resolves only that list, then each proof is checked independently;
ledger outages remain distinct from invalid records. The management secret is
revocation-only. The card presents organization branding as profile decoration,
with a collapsible hash for technical cross-checking. A stable wallet-profile
QR is intentionally not used. This share does not prove presenter identity and
cannot recall individually public credentials or copies already made.

The 2026-10-04 share update passed the production web build, API build, and
`test:e2e:wallet-shares`. The Impeccable detector returned no findings for
changed web UI files. T3
DOM checks at 1280px and 390px found no horizontal overflow; the selected-share
receiver exposed the expected noindex metadata, accessible QR label, expiry,
and an explicit ledger-unavailable message. The T3 snapshot endpoint failed
repeatedly for this tab, so the update has no saved screenshot or fresh visual
capture.
The full UI score remains the previous 15/20 baseline. This source and browser
pass is not a re-score of every authenticated, issuer, superadmin, organization,
and authenticated wallet workflow checks remain release evidence gaps.
