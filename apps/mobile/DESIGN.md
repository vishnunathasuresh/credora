---
name: Credora mobile
description: Quiet, precise native credential carrying and public verification
---

# Credora mobile design

## Overview

Inherit the root `DESIGN.md` identity: quiet, precise, and inspectable. Adapt it to a phone interface built from Tamagui native primitives. A direct task heading and action precede help; QR presentation is the signature interaction. Preserve the distinction between saved links and verified public records in visible copy.

## Colors

`tamagui.config.ts` uses `@tamagui/config/v4`'s default configuration with React Native style compatibility. System appearance selects its `light` or `dark` theme. Use `$background`, `$color`, and `$borderColor` for the neutral canvas, readable copy, and structural borders. Primary actions and the selected tab use `themeInverse`. Do not introduce a new brand accent or treat every saved link as verified.

QR presentation retains a white panel with a black code in both themes for scanning. It is the purposeful fixed-color exception to theme adaptation.

## Typography

Use the configured Tamagui type system. Current task headings are 32px, scan/presentation headings 30px, section headings 22px, and compact supporting details 12–14px. Hashes and addresses are selectable text; keep them inspectable rather than substituting decorative identifiers. Validate large text and long names on devices before claiming fit.

## Layout

Phone-first, single-column task content scrolls within safe areas, with a header above and three persistent bottom tabs: Credentials, Verify, Setup. Content is full width up to 720px and centered on wider previews. Use Tamagui spacing tokens for grouping. Buttons have at least 48px height, inputs 52px, and tabs 52px; wrapping action rows accommodate limited width.

Scan and QR presentation temporarily replace the task view and hide the tab bar. Provide explicit cancel/back actions; Android back returns through these views before leaving the app. iOS keyboard avoidance and scrollable forms keep entry tasks usable.

## Elevation & Depth

Use flat tonal surfaces, separators, and calm borders to define hierarchy. The implemented native surface does not rely on decorative shadows or floating dashboards.

## Shapes

Use the configured Tamagui radius tokens for cards, status notices, and QR panels. The camera preview has a 12px radius. Keep shape language restrained and consistent with the web identity.

## Components

Compose Button, Input, H1, H2, Paragraph, Text, Separator, Spinner, ScrollView, XStack, and YStack from Tamagui. Keep camera, QR rendering, safe areas, and system sharing native. Do not reproduce web Dialog or DOM controls inside the native app.

Empty-library help includes Add and Scan actions. Saved entries show the credential name, inspectable hash, and a reminder to recheck the record. Verification results use a named outcome, explanation, and retry or save/export actions as appropriate. Loading spinners and polite status announcements accompany asynchronous work. Error copy distinguishes service, ledger, metadata, input, camera, storage, and sharing failures.

Pair QR presentation with the credential hash and a public-link sharing action. Public JSON export follows successful service-backed verification and explains that recipients must reverify; avoid visual badges that imply an exported file independently proves validity.

## Do's and Don'ts

- Keep verification usable without wallet setup and offer paste as the camera fallback.
- Preserve accessible labels, selected tab semantics, selectable protocol values, and explicit recovery actions.
- Keep local-library actions visually distinct from issuance and wallet signing.
- Do not seed illustrative credentials, add generated illustration assets, or introduce a replacement identity.
- Do not claim native visual, screen-reader, camera, or share-sheet validation from bundle success. Device/emulator captures and VoiceOver/TalkBack checks remain pending.
