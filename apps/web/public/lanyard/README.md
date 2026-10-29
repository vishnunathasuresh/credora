# Credential lanyard provenance

The interactive badge implementation in `src/components/Lanyard.tsx` is copied
from the React Bits `Lanyard-TS-TW` registry item using the shadcn CLI on
2026-10-29, then customized for the Credora credential facade.

- Component: https://reactbits.dev/components/lanyard
- Registry source: `@react-bits/Lanyard-TS-TW`
- Upstream project and license: https://github.com/DavidHDev/react-bits
- Runtime dependency: `three` (installed by the registry item)
- No stock badge, GLB, or external strap texture is used. Badge face textures
  are generated locally from the credential data; the strap and hardware are
  procedural in the copied component.

React Bits is distributed under its MIT + Commons Clause license. The project
license prohibits selling or offering the source or a modified version as a
competing product or service. Review upstream `LICENSE.md` for the full terms.
