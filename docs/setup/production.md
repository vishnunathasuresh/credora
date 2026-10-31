# Production setup

The web runtime is TanStack Start, built with Vite. The production Dockerfile
builds the web client and server output, then serves the client assets alongside
the TanStack server entry. The Compose stack builds the web app and API on the
host and routes HTTPS traffic through Caddy.

Follow the authoritative [production deployment and operations guide](../../deploy/README.md)
for the environment template, Compose checks, startup, and SQLite backup
recovery. Do not treat the configuration or a successful local build as proof
of a live deployment.

## Supabase Auth (optional)

For Google sign-in, configure the web build with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, and configure the API runtime with the matching
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. All four values must identify the
same project. The web values are public and compiled into the browser bundle;
the publishable key is not a secret. Never use a Google client secret or
Supabase secret/service-role key as a browser build value.

The exact app callback is `https://<CREDORA_DOMAIN>/auth/callback`. Add this URL
to the Supabase Auth redirect URL allowlist. In Google Cloud, register the
Supabase Auth provider callback shown in the Supabase Google provider settings,
normally `https://<project-ref>.supabase.co/auth/v1/callback` (or the configured
custom Auth domain). Configure those external services yourself; repository
configuration does not create projects or credentials.

The two web variables are optional. When they are absent, public verification
and legacy wallet workflows remain available while account sign-in reports its
configuration as unavailable. After changing either `VITE_SUPABASE_*` value,
rebuild and recreate the web image with Compose; changing only the running
container environment cannot change values already compiled into its assets.
`NEXT_PUBLIC_*` values are also available to SSR at runtime through Compose, so
keep them aligned with the browser build values and recreate the web container
when changing them. Other runtime-only web settings need container recreation,
not an image rebuild; use Compose with `--no-build --force-recreate web` for
those changes. API `SUPABASE_*` values are runtime settings and need an API
container restart or recreation when changed.

Before opening a service to users, verify the web and API domains use HTTPS,
`/readyz` succeeds against the intended production registry, and persistent
storage and off-host backup restoration have been exercised. A compose config
check or image build is not deployment readiness evidence. The app does not
expose seeded credential records. Images attached during issuance are public
assets addressed from the credential metadata manifest.
