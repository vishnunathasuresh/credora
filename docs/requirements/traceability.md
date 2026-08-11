# Initial traceability

| Requirement              | Implementation boundary                |
| ------------------------ | -------------------------------------- |
| Wallet authentication    | `packages/auth`, app wallet adapters   |
| Authorized issuance      | `contracts/src/CredentialRegistry.sol` |
| Deterministic proof      | `packages/credential-core`             |
| Metadata storage         | `packages/storage`                     |
| Independent verification | `packages/blockchain`, `/verify`       |
| Skill Wallet             | `apps/web`, `apps/mobile`              |
| Audit projection         | `apps/api`, contract events            |
| Low-cost MVP             | Anvil, local storage, SQLite           |
