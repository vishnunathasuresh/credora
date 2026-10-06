# Mobile app setup

The Expo app is a holder and verifier for public credential references. It
does not contain a signing wallet. You can run a browser preview, use Expo Go,
or create native Android/iOS builds.

## Browser preview

Start the web app and API as described in
[local development](local-development.md), then run:

```sh
pnpm --filter @credora/mobile web
```

## Expo Go on a phone

Start the API and website on your development computer. In another terminal,
set the computer's LAN address and start Expo:

```sh
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 EXPO_PUBLIC_WEB_URL=http://192.168.1.20:3000 pnpm dev:mobile
```

Replace `192.168.1.20` with the computer's actual LAN address. The phone and
computer must be on a network that allows them to reach each other. `localhost`
on a phone points back to the phone, not to the computer. If the app is already
running, you can change the API and website addresses in its Setup tab.

For the browser preview (`pnpm --filter @credora/mobile web`), allow its exact
origin in the API's `API_ALLOWED_ORIGINS` setting (Expo commonly uses
`http://localhost:8081`). The default `.env.example` includes localhost
origins for both the Next.js and Expo web previews.

Scan is available after granting camera permission. If permission is denied,
paste a verification link instead. Sharing a QR does not prove control of the
learner wallet; it shares public records that recipients can independently
check.

## Android and iOS bundle exports

From the repository root, export both platform bundles:

```sh
pnpm --filter @credora/mobile exec expo export --platform android --platform ios
```

This checks JavaScript bundling. It does not create signed store builds or
replace real-device checks for camera access, sharing, accessibility, safe
areas, and system navigation.

## Mobile environment values

- `EXPO_PUBLIC_API_URL` — API base URL reachable by the phone.
- `EXPO_PUBLIC_WEB_URL` — public verifier URL used in shared links.

These are public addresses, not secrets. Never place wallet recovery phrases,
private keys, or API upload tokens in Expo variables.
