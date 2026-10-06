# Production setup

Credora's self-hosted setup serves the Next.js web app at the main domain and
the API at `api.<domain>`, behind Caddy-managed HTTPS. SQLite, IPFS metadata,
and rotating backups use a persistent Docker volume.

Follow the authoritative [production deployment and operations guide](../../deploy/README.md).
It covers the environment template, required DNS records, production RPC and
registry, restricted browser origin, IPFS credentials, configuration checks,
startup, health, and backup restoration.

The repository's CD workflow publishes the API image to GitHub Container
Registry. It does not log into or deploy to a hosting server. Mobile app store
distribution is a separate Expo release process; see [mobile setup](mobile.md).

Before opening the service to users, confirm `/readyz` succeeds against the
production registry, web and API domains use HTTPS, the storage volume and
backups are persistent, and the configured registry is the intended network.
The `/demo` catalog remains synthetic in production too.
