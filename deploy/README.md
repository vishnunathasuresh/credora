# Production deployment

Copy the template with `cp deploy/.env.production.example deploy/.env.production`.
Fill its required values before deploying. Set the
domain and its `api.` DNS record to this host, then provide the production RPC,
chain ID, deployed registry address, browser-visible RPC/registry settings,
and IPFS upload/gateway credentials. `API_ALLOWED_ORIGINS` must contain the
web origin (for example, `https://credentials.example.com`). Keep upload tokens
server-side; never use an Anvil key or a development registry on a public chain.

Validate the Compose configuration and start the web app, API, HTTPS proxy,
and scheduled SQLite backup worker with:

```sh
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml config --quiet
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d --build
```

Caddy serves the web app at `CREDORA_DOMAIN` and the API at
`api.CREDORA_DOMAIN`, obtains HTTPS certificates for both, and forwards traffic
to the private Compose network. The API health check uses `/readyz`, so it only
reports healthy after the configured registry can be reached. The API keeps
the SQLite database, metadata, and rotating backups in the `credora-data`
volume. Keep the API off public ports when `API_TRUST_PROXY=true`. Restore by
stopping the API, replacing `credora.sqlite` with a verified backup, and
starting the stack again.

The CD workflow publishes the API container image; it does not connect to or
deploy onto a hosting server. This Compose stack builds both apps on the target
host. Point both DNS names at that host and check `docker compose ps` plus
`https://api.<domain>/readyz` after startup. Mobile distribution remains a
separate Expo build configured with the same public API and web URLs.
