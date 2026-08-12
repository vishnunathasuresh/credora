# Backend deployment

Copy `.env.example` to `deploy/.env.production`, set a real
`CREDORA_DOMAIN`, RPC/registry values, restricted `API_ALLOWED_ORIGINS`, and
the IPFS upload/gateway credentials. Start the API, HTTPS proxy, and scheduled
SQLite backup worker with:

```sh
docker compose -f deploy/docker-compose.yml up -d --build
```

Caddy terminates HTTPS and renews certificates for `CREDORA_DOMAIN`. The API
keeps the SQLite database, metadata, and rotating backups in the `credora-data`
volume. Restore by stopping the API, replacing `credora.sqlite` with a verified
backup, and starting the stack again.
