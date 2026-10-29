# Component sources

The user selected shadcn.io and React Bits for the replacement redesign.
Existing local Radix/shadcn controls remain the form and overlay foundation.

## Selected references

- [shadcn.io sidebar](https://www.shadcn.io/ui/sidebar): application navigation
  and responsive collapse patterns.
- [shadcn.io avatar](https://www.shadcn.io/ui/avatar): person-first identity and
  initial fallback patterns.
- [shadcn.io tabs](https://www.shadcn.io/ui/tabs): accessible grouped navigation.
- [React Bits Lanyard](https://reactbits.dev/components/lanyard): exact user-selected
  component, inspected and installed with the shadcn CLI before adaptation.

## Shoogle discovery

Search uses item names rather than semantic layouts. The queried namespace
`@shadcn-io` was reported unknown by Shoogle; shadcn.io's public component docs
were read directly. That does not imply its website is unavailable.

| name          | registry     | homepage                 | add command                                            | type               | description                                     |
| ------------- | ------------ | ------------------------ | ------------------------------------------------------ | ------------------ | ----------------------------------------------- |
| Lanyard-TS-TW | @react-bits  | https://reactbits.dev/   | `pnpm dlx shadcn@latest add @react-bits/Lanyard-TS-TW` | registry:component | Swinging draggable 3D badge; selected by user.  |
| avatar-stack  | @shadcncraft | https://shadcncraft.com/ | `pnpm dlx shadcn@latest add @shadcncraft/avatar-stack` | registry:ui        | Overlapping avatars; discovered, not installed. |
| avatar9       | @shadcnuikit | https://shadcnuikit.com/ | `pnpm dlx shadcn@latest add @shadcnuikit/avatar9`      | registry:component | Avatar; discovered, not installed.              |
| avatar8       | @shadcnuikit | https://shadcnuikit.com/ | `pnpm dlx shadcn@latest add @shadcnuikit/avatar8`      | registry:component | Avatar; discovered, not installed.              |
| avatar7       | @shadcnuikit | https://shadcnuikit.com/ | `pnpm dlx shadcn@latest add @shadcnuikit/avatar7`      | registry:component | Avatar; discovered, not installed.              |

Avatar search returned 100 indexed matches, page 1–4. Lanyard discovery returned
6 matches, page 1–4; the exact React Bits selection made alternatives unnecessary.
No community avatar component or paid block was installed from this comparison.
