# Foundry contracts

Install the two development libraries once on a machine with Foundry:

```sh
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

Then run from the repository root:

```sh
pnpm contracts:build
pnpm contracts:test
```

The local development target is Anvil. Deployment requires `PRIVATE_KEY` and
uses the local RPC URL configured by the root command; never use a real funded
key for local tests.
