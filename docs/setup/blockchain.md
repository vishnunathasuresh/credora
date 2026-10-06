# Local blockchain and contracts

This workflow adds a local EVM registry to the web and API setup. Use a local
Anvil chain and its ephemeral keys only. Never send Anvil keys or funded
development accounts to a public network.

## Install Foundry and fetch contract dependencies

Install Foundry using the [official installation guide](https://getfoundry.sh/getting-started/installation/).
Then, from the repository root:

```sh
pnpm contracts:deps
pnpm contracts:build
pnpm contracts:test
```

`pnpm contracts:deps` initializes the pinned Solidity libraries as Git
submodules. Run it once after cloning or when submodules are missing.

## Start Anvil and deploy the registry

In one terminal, start the local chain:

```sh
pnpm anvil
```

It listens at `http://127.0.0.1:8545` on chain ID `31337` and prints funded
development accounts and their well-known test keys. Keep this chain local.

In a second terminal, deploy with the first key printed by Anvil. The checked-in
default key below is public and only safe for this throwaway local chain.

```sh
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 pnpm contracts:deploy
```

PowerShell equivalent:

```powershell
$env:PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
pnpm contracts:deploy
Remove-Item Env:PRIVATE_KEY
```

The deployment address is written to
`contracts/broadcast/Deploy.s.sol/31337/run-latest.json`. Update the existing
values in root `.env.local`:

```dotenv
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
CREDENTIAL_REGISTRY_ADDRESS=0xYourDeployedRegistry
```

Set the same chain and registry address in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS=0xYourDeployedRegistry
```

Restart the API and Next.js dev server after changing environment values.
The API syncs registry events into its SQLite projection; the registry remains
authoritative.

## Authorize a development issuer

Connect the deploying Anvil account as superadmin at `/superadmin`, then
authorize a separate development wallet as an issuer. Switch the wallet to
chain `31337` and confirm that its RPC is `http://127.0.0.1:8545`. Open
`/issuer` with the authorized wallet to draft and issue a credential. Issuance
is an on-chain transaction; a successful API login alone does not authorize a
wallet to issue.

For production, use a deployed registry and production keys. See
[production setup](production.md).
