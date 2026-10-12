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
issuer account through the deployed registry before creating issuance drafts.

The organization-aware credential protocol uses a separate v3 registry so the
v1 deployment and existing proofs remain unchanged. Its deployment entrypoint
is `script/DeployOrganizationCredentialRegistry.s.sol`. Do not point the
current v1 web/API configuration at that registry; organization activation,
issuer projections, and v3 verification remain separate migration work
tracked by [ADR 0010](../docs/decisions/0010-organization-controlled-issuer-authority.md).

For a local Anvil deployment, use a fresh local key and run:

```sh
forge script script/DeployOrganizationCredentialRegistry.s.sol:DeployOrganizationCredentialRegistry \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

The deployment grants protocol-admin authority to the deployer. Never deploy
this registry to a public chain until activation, projection, and v3
verification are integrated and reviewed.
