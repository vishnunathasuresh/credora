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
