# Production setup

The web runtime is now TanStack Start. Deployment configuration migration is
explicitly deferred: existing Docker/Vercel settings may still assume Next.js
and must be updated manually before deployment. Local production serving uses
`pnpm --filter @credora/web build` followed by `pnpm --filter @credora/web start`.

The deployment guide describes the intended web/API domain split, Caddy HTTPS,
SQLite, IPFS metadata and persistent backups; it is not evidence that the
TanStack runtime is deployed.

Follow the authoritative [production deployment and operations guide](../../deploy/README.md).
It covers the environment template, required DNS records, production RPC and
registry, restricted browser origin, IPFS credentials, configuration checks,
startup, health, and backup restoration.

The repository's CD workflow publishes the API image to GitHub Container
Registry. It does not log into or deploy to a hosting server.

Before opening the service to users, confirm `/readyz` succeeds against the
production registry, web and API domains use HTTPS, the storage volume and
backups are persistent, and the configured registry is the intended network.
The app does not expose seeded credential records. Images attached during
issuance are public assets addressed from the credential metadata manifest.
