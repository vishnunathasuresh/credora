# Foundry contracts

Initialize the pinned development libraries once after cloning:

```sh
pnpm contracts:deps
```

Then run from the repository root:

```sh
pnpm contracts:build
pnpm contracts:test
```

The local development target is Anvil. In one terminal:

```sh
pnpm anvil
```

In another terminal, deploy with the first ephemeral Anvil key. Never use a
real funded key for local tests:

```powershell
$env:PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
pnpm contracts:deploy
```

The deployment address is written to
`contracts/broadcast/Deploy.s.sol/31337/run-latest.json`. Authorize an Anvil
issuer account through the deployed registry before creating legacy issuance drafts.

The organization-aware credential protocol uses a separate v3 registry so the
v1 deployment and existing proofs remain unchanged. Its deployment entrypoint
is `script/DeployOrganizationCredentialRegistry.s.sol`. Configure its address
separately as `ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS` in the API and
`NEXT_PUBLIC_ORGANIZATION_CREDENTIAL_REGISTRY_ADDRESS` in the web app. The
organization registry activates organizations, delegates issuer wallets, and
stores v3 organization-bound credential proofs. Existing v1 credentials remain
on the original registry.

For a local Anvil deployment, use a fresh local key and run:

```sh
forge script script/DeployOrganizationCredentialRegistry.s.sol:DeployOrganizationCredentialRegistry \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

The deployment grants protocol-admin authority to the deployer. Organization
activation and suspension require the registry-admin wallet; issuer
authorization is organization-admin controlled after activation. Verify the
deployed address and chain before configuring production.
