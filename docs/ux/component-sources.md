# UI component sources

This manifest records the current Opensource UI Studio direction. Earlier
shadcn.io exploration was a historical reference, not a requirement for new
UI. Existing local primitives remain in use where they provide the right
semantics and behavior. Remove a dependency only after its final consumer has
been replaced and its behavior verified.

| Component and surface                        | Decision                                   | Source and local implementation                                                                                                                         | Notes                                                                                                                 |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Profile identity in the landing illustration | Adapt                                      | [Editorial Staff Profile](https://opensourceui.in/components/editorial-staff-profile); `apps/web/src/components/profile/editorial-profile-identity.tsx` | Uses initials and profile fields instead of the stock image, roster index and bio. Illustrative only.                 |
| Copy link feedback in sharing                | Adapt                                      | [Copy to Clipboard](https://opensourceui.in/components/copy-button); `apps/web/src/components/ui/opensource-ui-copy-button.tsx`                         | Caller owns clipboard and fallback errors; pending and timed confirmation remain explicit.                            |
| Public and workspace navigation              | Custom                                     | `apps/web/src/routes/__root.tsx`, `apps/web/src/components/mobile-navigation.tsx`                                                                       | Inspired by the Opensource UI site's neutral navigation; native links and a keyboard-accessible mobile dialog.        |
| Buttons, fields and dialogs                  | Adapt local                                | `apps/web/src/components/ui/`                                                                                                                           | Existing Radix-backed behavior and local styling; not copied from the Opensource UI catalog.                          |
| Credential proof and lanyard                 | Custom plus existing React Bits adaptation | `apps/web/src/components/credential-card.tsx`, `apps/web/src/components/credential-lanyard.tsx`, `apps/web/src/components/Lanyard.tsx`                  | Proof state and static accessibility path remain Credora-specific. React Bits attribution is under `public/lanyard/`. |
| Workspace overview and verification form     | Custom                                     | `apps/web/src/components/role-dashboard.tsx`, `apps/web/src/components/verify-form.tsx`                                                                 | Account, camera, QR and service states follow the existing application contracts.                                     |

The two Opensource UI adaptations retain their MIT notice in
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md). No upstream photography
or demo data is shipped. Instrument Serif's license is stored with the bundled
font; Geist is installed through `@fontsource-variable/geist`.

Reference study: [Opensource UI catalog](https://opensourceui.in/components),
[design reference](https://github.com/bidyut10/opensourceui/blob/main/skills/opensource-ui/references/design.md),
[Apple Browser mockup](https://opensourceui.in/components/browser),
and [Fine Grain pattern](https://opensourceui.in/components/fine-grain-pattern). The
latter two were studied as presentation options; their code and assets are not
used. A real product view or clearly labeled illustration is preferable to a
fabricated screenshot, and the application surfaces stay neutral.
