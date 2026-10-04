# Credora UI/UX audit

Audited 4 October 2026 using Impeccable, Credora protocol guidance, source review,
a production web build, browser interaction checks, and Expo bundle exports.
This report distinguishes code and browser evidence from native device evidence.

## Implementation integrity

The web now uses registry-sourced shadcn Button, Input, Label, Textarea,
NativeSelect, Card and Dialog primitives. Semantic page structure, existing
neutral styling and the proof visualization remain product-specific. Native
controls and layout use Tamagui. Shared reference parsing lives in
`packages/shared`; protocol normalization stays in `credential-core`.
The API remains a convenience projection/service, and the registry plus
metadata remain authoritative. The native UI explicitly identifies saved links
and downloaded JSON as copies, not proof of wallet possession or offline proof.

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
wallet state, native library persistence, documentation, and current verifier
captures. The fixes were applied as one batch. Holder loading was checked with
an invalid synthetic cached session: service failure showed an unavailable/retry
state, with no “No confirmed credentials found” claim. The temporary session
was removed.

The mobile browser preview exercised malformed input, service unavailable,
a clearly named synthetic verification fixture, save, QR presentation and remove.
The fixture was deleted afterwards. Tests cover reference parsing, malformed
stored data, successful metadata normalization, API/ledger distinction, missing
records, metadata unavailable, mismatch and malformed responses. These are
synthetic UI and unit checks, not real issued credentials.

Passed: workspace typecheck/tests, web production build, Expo compatibility
check, and Android/iOS Hermes plus web bundle export. The web Impeccable detector
returned no findings. It does not audit native code.

## Findings addressed

| Priority | Finding / location                      | User impact                                                            | Resolution                                                                                                |
| -------- | --------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| P1       | Custom controls throughout web          | Component drift; sharing modal lacked reliable focus/keyboard handling | Real shadcn controls and Radix Dialog focus management, Escape and focus return                           |
| P1       | Wallet connect screens                  | New users had no route from unfamiliar wallet terminology to sign-in   | Shared three-step guide: official wallet setup, public address, signed message; explains no gas for login |
| P1       | Mobile starter                          | Sample records claimed verified/offline-ready status without evidence  | Removed samples and offline claims; real empty library and explicit online verification                   |
| P1       | Homepage CTA after component migration  | Primary link text had the same foreground/background                   | Explicit shadcn primary-anchor foreground; measured both themes                                           |
| P1       | Holder restored-session request failure | API outage could look like a confirmed empty library                   | Loading/unavailable/retry state; empty only after a successful list response                              |
| P1       | Mobile initial storage failure          | Later save could overwrite an unread library                           | Disable writes and show library unavailable until a successful reload                                     |
| P2       | Form placeholders, focus and targets    | Low-contrast placeholders and compact actions impeded interaction      | Token-based placeholder text, focus coverage and 44px web / 48px native target minimums                   |
| P2       | Hash-only web reference entry           | Public links required manual hash extraction                           | Same link-or-hash parser for web and mobile; invalid QR URLs are never automatically followed             |
| P2       | Native infrastructure errors            | API outages could be confused with unavailable blockchain              | Separate service/ledger/metadata/malformed/mismatch states, retries and explicit unverified status        |
| P2       | Setup documentation                     | README described mobile as paused                                      | Updated runnable commands, device server addresses, wallet setup and capability limits                    |

## Native audit and outstanding checks

Native source expresses the requested holder/verifier tasks and uses neutral
Tamagui themes, safe-area insets, keyboard handling, Android Back, labelled
inputs, accessible tab state and 48px actions. Only phone-first behavior is
intended. There was no connected device, Android emulator or iOS simulator.
Native accessibility, platform conformance and adaptive-layout scores are
therefore **not certified or totaled**. Browser previews cannot substitute for
native screenshots or runtime tests.

| Priority              | Open item                                                                                                                  | Impact / next check                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P1 release validation | Camera permission/scanning, native JSON export/share, safe areas, rotation, large text, VoiceOver/TalkBack and system Back | Validate on actual Android/iOS phones before claiming native release readiness; `$impeccable audit` with native captures        |
| P2                    | Native ScrollView renders saved links eagerly, bounded at 100 (`apps/mobile/App.tsx`)                                      | Profile a populated library on a phone; virtualize if scrolling/startup cost warrants it; `$impeccable optimize`                |
| P2 validation         | Authenticated issuer/admin/organization workflows and real issued credentials                                              | Exercise with authorized test wallets and configured Anvil/IPFS; disconnected screenshots and fixtures do not prove these flows |
| P3                    | Legacy CSS rules coexist with shadcn utility classes                                                                       | Consolidate as a separate measured extraction task to avoid future token precedence regressions; `$impeccable harden`           |

P0 issues: none observed. Open native release validation is an evidence gap,
not a claim that the camera or share sheet is broken. Native signing-wallet
integration and original attachment downloads were not implemented; the app
uses the web wallet flow and exports the public credential JSON available in v1.

The final reviewer disposition is **ship for the scored web fixes only**:
settled desktop and phone captures now confirm the homepage action, verifier
copy and Hugeicons rendering. See [finish review](finish-review.md). Native
device evidence and authenticated workflow coverage remain incomplete.

The next visual step after device/authenticated checks is `$impeccable polish`.
Keep it bounded to defects demonstrated by those checks.

Hugeicons supplies the web and native glyphs. Native imports individual icon
modules so Metro does not include the entire free icon catalogue. Icons retain
visible action labels and are hidden from assistive technology when decorative.

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

The 2026-10-04 share update passed the production web build, API build, mobile
typecheck/tests, Android/iOS Hermes export, and `test:e2e:wallet-shares`. The
Impeccable detector returned no findings for changed web/native UI files. T3
DOM checks at 1280px and 390px found no horizontal overflow; the selected-share
receiver exposed the expected noindex metadata, accessible QR label, expiry,
and an explicit ledger-unavailable message. The T3 snapshot endpoint failed
repeatedly for this tab, so the update has no saved screenshot or fresh visual
capture. Native WebGL artwork is in the Expo GL bundle, but physical-device
shader rendering and fallback behavior have not been exercised.

The full UI score remains the previous 15/20 baseline. This source and browser
pass is not a re-score of every authenticated, issuer, superadmin, organization,
and native device state. Native runtime QA and authenticated wallet workflow
checks remain release evidence gaps.
