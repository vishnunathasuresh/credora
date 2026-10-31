# TanStack Start redesign

Status: implemented and reviewed, 2026-10-29. The agreed product direction is
in [product-direction.md](../roadmap/product-direction.md); the implemented
visual system is specified in [DESIGN.md](../../DESIGN.md). This record keeps
the initial audit and design rejection as history, then states the built result
and the evidence boundary.

## Historical baseline

The initial audit found a verifier-first homepage without a profile entry,
holder identity represented by a wallet address, competing credential and QR
hierarchy, legacy mixed token CSS, and narrow-screen organization/admin views
that needed browser review. The scoped source-and-desktop score was 11/20
(accessibility 3/4, performance 2/4, responsive 2/4, theming 2/4, integrity
2/4); it was an audit judgment, not a WCAG certification or mobile score. A
single 1280×800 production observation recorded 544 ms TTFB and 1331 ms
DOMContentLoaded. It was neither field data nor a controlled comparison.

The first sparse serif folio was rejected. The selected direction is a
professional network with expressive, person-first public profiles and
restrained workspaces. Do not use the rejected folio as a current design
contract; [DESIGN.md](../../DESIGN.md) owns the current system.

## Built product

- The web app uses TanStack Start, Vite, typed TanStack Router routes, and the
  semantic light/dark CSS tokens described in DESIGN.md. Geist Variable is
  locally served. Tailwind is restored.
- Public profile, verification, and temporary-share surfaces are standalone.
  The private profile/credential and issuer/admin routes use the workspace
  shell, with a desktop sidebar and mobile navigation.
- The profile editor supports HTTPS avatar URLs, links, projects, experience,
  education, and ordered credential selection. Project, experience, and
  education entries have stable IDs, reorder controls, and a maximum of eight
  items per list. Profile publication remains explicit and opt-in.
- Public profiles show user-authored content separately from selected
  credential summaries. A summary does not claim fresh verification. Profile
  sharing uses clipboard support with a native share fallback.
- The full credential view and labeled illustrative homepage preview use the
  React Bits lanyard implementation, including upstream Verlet rope physics.
  The Three.js renderer is lazy and starts only after interaction. Accessible
  HTML proof details and a working static flip remain available for reduced
  motion or unavailable WebGL. No stock GLB is used; procedural local texture
  data is used. The public source and license are in `public/lanyard/`.
- Profile content, handles, publication settings, and selections are
  authoritative application data requiring durable backup. Chain-derived
  credential rows remain rebuildable projections; the ledger and
  content-addressed metadata remain authoritative for proof. See
  [ADR 0011](../decisions/0011-profile-identity-and-publication.md).

Pre-wallet signup, account recovery, and wallet reassignment remain future
work. Follows, feeds, jobs, messaging, discovery, and recommendations are not
shipped networking features. Continue to follow the product delivery order.

## Review and verification

The root workspace review completed `pnpm typecheck`, `pnpm build`,
`pnpm lint`, and nine unit tests. Profile end-to-end coverage passed for rich
profile round-trip, privacy, ordering, backward compatibility, and validation;
wallet and temporary-share end-to-end coverage passed. Built web routes and
secret/identifier boundary checks passed.

Local browser review used a synthetic account. Saving and reordering profile
entries persisted and appeared in the public DOM; the avatar rendered. The
share dialog was inspected at mobile width, and the 390px layout had no
horizontal overflow. Browser review also confirmed the lanyard canvas and
interactive flip, plus the reduced-motion static view and its working flip.
No credentials were present in the local fixture, so the credential summary's
visual presentation was not browser-verified; API tests cover its summary
output.

Review captures are under `.impeccable/review/`: `network-home-light-desktop`
and `network-home-light-mobile`, `network-rich-editor-desktop` and
`network-rich-editor-mobile`, `network-rich-public-desktop` and
`network-rich-public-mobile`, and `network-badge-active-mobile`. Corrected
superadmin and malformed-state captures are also retained there. The first
review found missing rich fields, low contrast, and corrupt screens. After
those fixes, a fresh reviewer verdict was **SHIP** at the reviewed fix-list
scope, with all three findings resolved. The Geist workhorse received one
accepted low-severity note; the review did not report zero issues.

The lanyard renderer bundle is 540.92 KB raw and 140 KB gzip. This records the
lazy feature chunk, not route-level transfer or a measured user experience.
No field Core Web Vitals or controlled before/after performance result is
available. Deployment repair was manually deferred because the preview was
broken; deployment state is not verified by this review.

## Remaining evidence limits

No local Foundry/Anvil environment was available for browser verification of
actual issuer/admin signed transactions. Successful API, route, build, and
fixture checks do not establish deployed service behavior, a live issuance,
or real credential summary rendering in a browser. Deployment and production
performance remain outside the completed review.

## Identity-first follow-up (PR 5, in progress)

ADRs 0012 and 0013 replace the transitional wallet-first profile entry with
Google sign-in through Supabase, account-owned private profiles, and separately
signed wallet associations. Legacy issuer authorization is unchanged. Local
account integration tests cover walletless profiles, account isolation, signature
binding/replay, ownership selection, unlink suppression and explicit legacy
migration/conflict behavior. Live Google OAuth still requires provider setup and
browser validation.

Public profiles now use server loaders and emit published identity in HTML and
social metadata. `/u/{handle}/image` renders a 1200x630 PNG from published name,
handle and headline with a server-only native renderer and bundled licensed font;
it does not fetch an avatar or add verification badges. Private/missing profiles
use generic metadata and have no image. No-store headers apply to both. Set
`VITE_SITE_URL` to the public origin for absolute metadata URLs. The Latin font
subset does not provide complete international-script coverage.

The built-route suite checks published SSR content, PNG format/dimensions and
private-profile metadata/image exclusion. A rendered PNG was visually inspected.
These checks do not prove crawler cache invalidation or live social platform
rendering. Further responsive journey review and design work remain in progress.

The first-run profile form now saves name, handle, headline and optional photo
privately before exposing the longer portfolio/publication editor. The editor
has a local unsaved preview; its share action targets only the last saved public
handle. A saved private profile with no wallets was created in an isolated mock
Supabase browser fixture, previewed while public lookup returned 404, then given
a project and explicitly published. The public page and QR PNG download worked.
This exercises the real client/API path with a synthetic auth provider, not
Google's OAuth ceremony. Account-switch guards bind profile mutations to the
intended Supabase subject. The account security suite now runs in CI.

Development also excludes the native social renderer from Vite dependency
optimization; this was verified by starting the configured fixture dev server,
which previously failed while trying to parse a native binary as JavaScript.
