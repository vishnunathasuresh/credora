# Setup troubleshooting

## Website does not open

- Confirm the web process is running and port 3000 is free.
- Check the terminal where `pnpm dev` or `pnpm dev:web` was started.
- If `NEXT_PUBLIC_*` values changed, restart Next.js; the dev server reads
  `apps/web/.env.local`.

## API does not respond

- Check port 4000 and the API process output.
- Open <http://localhost:4000/health> to check process health.
- Root `.env.local` configures the API. Verify `API_PORT` agrees with the
  website's `NEXT_PUBLIC_API_URL`.

## `/readyz` reports `LEDGER_UNAVAILABLE`

`/health` can return 200 while the ledger is unavailable. `/readyz` requires a
working RPC endpoint, matching chain ID, and deployed registry address. For
local chain-backed development, start Anvil, deploy the registry, and use the
same address and chain ID in both API and web environment files. Without Anvil,
the UI and synthetic demo still run, but real local issuance and verification
do not.

## Browser requests are blocked

The API only returns browser CORS headers for origins listed in
`API_ALLOWED_ORIGINS`. Add the exact website origin (including scheme and
port), then restart the API. Native requests from the Expo app do not use
browser CORS.

## Metadata is unavailable

Local FileStorage metadata is accessible through the API only. Independent
verification from another client requires IPFS-backed metadata and a reachable
gateway. An unavailable gateway is a service failure, not an invalid proof.

## Physical phone cannot reach local services

Use the computer's LAN IP in `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL`.
The phone and computer must share a reachable network, and the firewall must
allow the API and web ports. `localhost` on the phone refers to the phone.
