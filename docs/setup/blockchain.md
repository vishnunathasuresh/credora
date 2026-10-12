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
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 pnpm contracts:deploy:organizations
```

PowerShell equivalent:

```powershell
$env:PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
pnpm contracts:deploy
pnpm contracts:deploy:organizations
Remove-Item Env:PRIVATE_KEY
```

The v1 deployment address is written to
`contracts/broadcast/Deploy.s.sol/31337/run-latest.json`; the organization
registry address is written to
`contracts/broadcast/DeployOrganizationCredentialRegistry.s.sol/31337/run-latest.json`.
Update both registry values in root `.env.local`:

```dotenv
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
CREDENTIAL_REGISTRY_ADDRESS=0xYourDeployedRegistry
ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS=0xYourDeployedOrganizationRegistry
```

Set the same chain and registry address in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS=0xYourDeployedRegistry
NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS=0xYourDeployedOrganizationRegistry
```

Restart the API and Next.js dev server after changing environment values.
The API syncs registry events into its SQLite projection; the registry remains
authoritative.

## Authorize a development issuer

Connect the organization-registry deployer at `/superadmin` and approve an
organization application. Approval requires one activation transaction that
grants its applicant wallet organization-admin and issuer authority. Organization
admins add or revoke additional issuer wallets from `/org`; platform admins do
not authorize individual organization issuers or credentials.

For production, use a deployed registry and production keys. See
[production setup](production.md).
