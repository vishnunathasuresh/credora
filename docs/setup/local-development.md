# Local web and API setup

## Requirements

- Node.js 22
- Corepack and the repository-pinned pnpm 10.32.1
- Git

## Install and start

From the repository root:

```sh
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile
[ -f .env.local ] || cp .env.example .env.local
[ -f apps/web/.env.local ] || cp .env.example apps/web/.env.local
pnpm dev
```

Open <http://localhost:3000>. `pnpm dev` starts the Next.js website and API;
the API listens at <http://localhost:4000>. Check its process health at
<http://localhost:4000/health>.

The `/demo` route and `GET /demo/catalog` API response are synthetic showcase
data. They work without Anvil and must not be treated as real issued
credentials. Without Anvil and a deployed local registry, `/readyz` reports
`LEDGER_UNAVAILABLE`, and chain-backed verification and issuance cannot run.

Stop both development processes with Ctrl+C. To start one service, use
`pnpm dev:web` or `pnpm dev:api` in a separate terminal.

## Environment files

- Root `.env.local` configures the API. `pnpm dev:api` loads it.
- `apps/web/.env.local` configures the browser build. Set
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID`,
  `NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS`, and, when used,
  `NEXT_PUBLIC_IPFS_GATEWAY_URL` there.
- `.env.example` provides local defaults. Copy it only when the target file
  does not already exist; keep tokens out of both browser-visible variables
  and Git.

If only browsing the UI or demo, the zero registry address and local RPC
defaults are sufficient. Follow [blockchain development](blockchain.md) to
enable real local issuance and verification. Do not use Anvil's public test
keys on a public chain.

## Individual project commands

```sh
pnpm dev:web
pnpm dev:api
pnpm --filter @credora/mobile web
```

The third command runs the mobile UI in a browser. For Expo Go or native app
setup, use [mobile setup](mobile.md).
