# TanStack Start redesign

Status: implementation plan, 2026-10-29. Scope is the complete web framework port
and replacement design, with profile groundwork. Networking and new non-wallet
account recovery remain later roadmap work.

## Audit

The deployed homepage and current source were inspected. The desktop homepage
has a coherent verifier but no profile entry or identity. The holder screen
identifies a person as an address and "Credential holder". Credential content
competes with QR, address, and projection copy. Most navigation uses document
links; Next-specific routing and server rendering require explicit migration.

Provisional source-and-desktop scores: accessibility 3/4, performance 2/4,
responsive 2/4, theming 2/4, implementation integrity 2/4 (11/20). These are
scoped audit judgments, not a WCAG certification or mobile performance score.

- P1, implementation integrity: `holder-wallet.tsx` lacks person-owned profile
  content. Build an editable identity and optional public profile.
- P1, implementation integrity: public result and credential card split proof,
  achievement, and issuer hierarchy. Replace with an achievement-led badge and
  distinct truthful proof states.
- P2, theming: legacy global CSS mixes literal colors and token surfaces. Replace
  the visual system with semantic light/dark tokens.
- P2, responsive: existing forms and dense organization/admin views need narrow
  viewport verification; static inspection is a hypothesis until browser checks.
- P2, performance: avoid carrying camera decoding and 3D into every route.
  Existing lazy camera imports are worth retaining. Route splitting, bounded
  preloads, and lazy lanyard loading are migration requirements.
- P2, integrity: remove eyebrow labels and implementation explanations from
  ordinary product flows. Keep necessary warnings and accessible field labels.

Positive findings: semantic public entry points, keyboard skip link, Radix
modal primitives, real verification states, and independent proof fallback.
Preserve those capabilities during replacement.

Single-session production desktop observation (1280×800, normal network,
2026-10-29): TTFB 544 ms, DOMContentLoaded 1331 ms. This is neither field data
nor a controlled before/after comparison. No CrUX/RUM or DevTools trace tool is
available in this session. Record local build sizes and browser observations
separately; do not claim improvement from unlike environments.

## Design contract

A personal professional folio: warm-white canvas, ink typography, deep cobalt
primary actions, precise hairlines, spacious asymmetric layout, and a physical
credential badge. No eyebrows, invented metrics, fake social activity, generic
feature-tile grid, or seeded production credentials. Organization identity and
achievement content lead. Use Hugeicons and existing Radix/shadcn primitives.

Landing: left-aligned identity headline and profile action beside an authored,
clearly illustrative credential artifact. Verifier remains a direct navigation
item and dedicated page. Signed-in home is task-oriented rather than marketing.

Workspace: restrained navigation, clear page title/action, credential library,
profile edit/publish controls, and role workspaces. Mobile collapses navigation
into an accessible sheet and content into one column. Touch controls are at
least 44px; long hashes and handles wrap without horizontal overflow.

Credential: organization and title on its face, recipient where available,
date, actual proof state; back contains detail and QR. Drag/swing/flip is the
signature interaction with a static reduced-motion fallback. Only matching
proof triggers a successful reveal. Other states remain explicit and retryable.

## Port contract and ownership

1. Replace Next.js with TanStack Start, Vite and typed TanStack Router routes.
   Preserve `/`, `/verify`, `/verify/:credentialRef`, `/wallet`, `/dashboard`,
   `/issuer`, `/org`, `/admin`, `/superadmin`, `/share/:token`, health and manifest.
2. Keep server-only gateway credentials and direct verification behind server
   functions. Public browser config uses explicit Vite variables; never expose
   the whole process environment. Preserve temporary-share noindex/no-store.
3. Use per-request QueryClient instances and appropriate query keys where they
   eliminate duplicate fetches. Keep auth-scoped data isolated and clear caches
   when sessions change. No blanket prefetching or optimistic proof validity.
4. Build the visual system and replace public and holder surfaces; carry all
   issuer/organization/admin behavior into the new shell.
5. Add stable profile IDs, unique handles, private-by-default publication, and
   selected credentials through authenticated API operations. Record the ADR
   before implementation. Wallet sessions are the transitional auth mechanism;
   do not imply that pre-wallet accounts or recovery have shipped.
6. Validate build/typecheck, existing protocol/API suites, all route responses,
   desktop/mobile keyboard and overflow behavior, and lazy-load boundaries.
   Deployment configuration repair is explicitly outside this pass.

Implementation uses Luna High for scoped port and UI work; reserve Terra for
identity/proof/privacy boundaries if needed. Root owns integration, lockfile,
review, commits, PR and merge. Each implementer owns named files and avoids
unrelated `demo/` content. Delivery is small commits on the feature branch.

## Replacement after user review

The user rejected the first sparse serif folio and selected **professional network

- restrained workspaces**. That visual implementation is superseded by DESIGN.md.
  The migration and profile functionality remain in scope and are preserved.

Current primary-source study: Peerlist (https://peerlist.io/) demonstrates a
handle-first identity entry and work-centric profile story; Contra
(https://contra.com/) leads with actual work presentation; Linear
(https://linear.app/) presents its working interface at meaningful scale. These
inform composition and density, not copied branding, claims or social counts.
The user explicitly selected https://www.shadcn.io/ for component reference and
https://reactbits.dev/components/lanyard for the actual physics-driven lanyard.

Replacement work: (1) one new visual system and full landing; (2) every inner
page and navigation; (3) actual React Bits integration replacing CSS imitation;
(4) fresh bounded desktop/mobile review and verification. No new deployment work.
