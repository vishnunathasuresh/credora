# Production deployment

This self-hosted Compose setup builds the TanStack Start web app and API on the
target host, then serves them behind Caddy. It is deployment configuration, not
evidence that a production deployment or its external services are ready.

## Configure

Copy the example to the ignored operator-owned file and fill in the production
domain, API origin, RPC, chain and deployed registry values, plus IPFS upload
and gateway settings:

```sh
cp deploy/.env.production.example deploy/.env.production
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are optional public
web-build settings. When enabling Google sign-in, set both to the same Supabase
project used by the API's runtime `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`. The publishable key is intended for browser use;
never put a Supabase secret/service-role key or Google client secret in either
web variable. Leave both web values empty to preserve public verification and
legacy wallet flows; account sign-in will be unavailable until configured.

The application's exact same-origin OAuth return URL is
`https://<CREDORA_DOMAIN>/auth/callback` (for example,
`https://credentials.example.com/auth/callback`). Add that full URL to the
Supabase project's Auth URL Configuration **Redirect URLs** allowlist. In
Google Cloud's OAuth client, the authorized redirect URI is the Supabase Auth
provider callback shown by Supabase, normally
`https://<project-ref>.supabase.co/auth/v1/callback` (or the matching callback
host if the project uses a custom Supabase Auth domain). Add Google provider
credentials in Supabase itself. This repository does not configure Google,
Supabase, DNS, or any external service.

The public `NEXT_PUBLIC_*` values configure both the browser bundle and
server-rendered verification/profile routes. Compose passes these values as
web-container runtime environment as well as Docker build arguments. Keep
`API_ALLOWED_ORIGINS` restricted to the exact web origin, such as
`https://credentials.example.com`; do not publish the API on a separate host
port while `API_TRUST_PROXY=true`.

## Validate and start

```sh
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml config --quiet
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d --build
```

Caddy serves the web app at `CREDORA_DOMAIN` and the API at
`api.CREDORA_DOMAIN`, obtains HTTPS certificates for both, and forwards traffic
to the private Compose network. The API health check uses `/readyz`; it requires
the configured registry to be reachable. `/health` alone reports process
health, not ledger readiness.

Temporary share URLs use `/share#<token>`. The fragment is not sent in the
initial page request; the browser sends the token in a POST body to the web
server function, which uses a fixed POST path and body to resolve it at the
API. The Caddyfile redirects legacy browser `/share/<token>` links to this
form before they reach the web container and adds `Cache-Control: no-store`
and `Referrer-Policy: no-referrer`. The API keeps `GET /wallet/shares/<token>`
for old clients; its bearer necessarily travels in the inbound request path.
Caddy does not enable access logs. Operators must configure every external
proxy, CDN, TLS terminator, load balancer, API gateway, and hosting log pipeline
to redact `/share/<token>` and `/wallet/shares/<token>` paths and never record
POST bodies containing share tokens. Credora cannot configure or verify
logging outside this Compose deployment.
The local production web runtime omits srvx's raw-URL access logger; its error
records contain only the error type. The Vite development server also redirects
legacy share paths before route handling.

The `VITE_SUPABASE_*` and `NEXT_PUBLIC_*` values are compiled into public
browser assets. After changing them, rebuild and recreate the web container
with the `up -d --build` command above; restarting an old image does not update
the browser bundle. Compose also passes `NEXT_PUBLIC_*` values at runtime, so
recreating the web container is required for SSR to pick up changed settings.
For runtime-only changes to other web-container environment, recreate without
rebuilding the image with
`docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d --no-build --force-recreate web`.
Changes to API `SUPABASE_*` runtime values require recreating/restarting the API
container. Keep the Supabase web and API values pointed at the same project.

The API stores SQLite data, metadata, and rotating backups in the
`credora-data` volume. Backups are scheduled every six hours and retained for
14 copies by default. Restore by stopping the API, replacing `credora.sqlite`
with a verified backup, and starting the stack again. Establish and test
off-host backups before relying on this volume for production recovery.

The CD workflow publishes the API container image; it does not connect to or
deploy onto a hosting server. After configuring DNS and starting the stack,
inspect `docker compose ps` and check `https://api.<domain>/readyz` against the
intended production registry. A successful configuration check or local image
build does not prove OAuth, DNS, TLS, persistent recovery, or production
readiness.
